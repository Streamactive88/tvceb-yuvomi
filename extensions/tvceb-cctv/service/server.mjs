import http from 'node:http';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSynology, CameraError } from './synology.mjs';
import { createRtsp } from './rtsp.mjs';

export const PREFIX = '/api/extensions/tvceb-cctv';
const sessionCookie = raw => String(raw || '').split(';').map(part => part.trim())
  .filter(part => /^(yuvomi|oikos)\.sid=/.test(part)).join('; ');

export function createHandler({ coreUrl, synology, adminOnly = true, fetcher = fetch, cacheMs = 2000 }) {
  const identities = new Map();
  async function identity(raw) {
    const cookie = sessionCookie(raw);
    if (!cookie || cookie.length > 4096) throw new CameraError('Please sign in to tvceb.', 401);
    const key = createHash('sha256').update(cookie).digest('hex');
    const current = identities.get(key);
    if (current && current.expires > Date.now()) return current.pending;
    if (identities.size >= 256) identities.delete(identities.keys().next().value);
    const pending = (async () => {
      let me; let modules;
      try {
        const options = { headers: { cookie }, redirect: 'error', signal: AbortSignal.timeout(5000) };
        const response = await fetcher(new URL('/api/v1/auth/me', coreUrl), options);
        if ([401, 403].includes(response.status)) throw new CameraError('Please sign in to tvceb.', 401);
        if (!response.ok) throw new CameraError('Cannot verify your tvceb session.', 503);
        me = await response.json();
        const registered = await fetcher(new URL('/api/v1/modules', coreUrl), options);
        if (!registered.ok) throw new CameraError('Cannot check CCTV module access.', 503);
        modules = (await registered.json()).data;
      } catch (error) {
        if (error instanceof CameraError) throw error;
        throw new CameraError('Cannot verify your tvceb session.', 503);
      }
      if (!me.user?.id) throw new CameraError('Please sign in to tvceb.', 401);
      if (!Array.isArray(modules) || !modules.some(module => module.id === 'tvceb-cctv' && module.enabled && !module.error)) {
        throw new CameraError('The CCTV module is disabled or unavailable.', 403);
      }
      const access = me.permissions?.modules?.['ext:tvceb-cctv'];
      if (!['read', 'write'].includes(access) || (adminOnly && me.user.role !== 'admin')) {
        throw new CameraError('You do not have permission to view these cameras.', 403);
      }
      return me.user;
    })();
    identities.set(key, { pending, expires: Date.now() + cacheMs });
    pending.catch(() => identities.delete(key));
    return pending;
  }
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    try {
      const path = new URL(req.url, 'http://sidecar').pathname;
      if (req.method === 'GET' && path === '/health') return json(200, { ok: true });
      if (!path.startsWith(PREFIX + '/')) return json(404, { error: 'Not found.' });
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(405, { error: 'CCTV access is read-only.' }); }
      await identity(req.headers.cookie);
      if (path === PREFIX + '/cameras') return json(200, { configured: synology.ready, source: synology.source || 'Synology Surveillance Station', cameras: synology.ready ? await synology.list() : [] });
      const match = path.match(/^\/api\/extensions\/tvceb-cctv\/cameras\/(0|[1-9][0-9]{0,9})\/snapshot$/);
      if (!match) return json(404, { error: 'Not found.' });
      const frame = await synology.snapshot(Number(match[1]));
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'X-Captured-At': new Date(frame.time).toISOString() });
      res.end(frame.bytes);
    } catch (error) {
      json(error instanceof CameraError ? error.status : 502, { error: error instanceof CameraError ? error.message : 'Camera service is temporarily unavailable.' });
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const secret = name => {
    try { return fs.readFileSync(process.env[name], 'utf8').replace(/\r?\n$/, ''); }
    catch (error) { if (error.code === 'ENOENT' || !process.env[name]) return ''; throw error; }
  };
  const synology = process.env.RTSP_CONFIG_FILE ? createRtsp({ config: JSON.parse(fs.readFileSync(process.env.RTSP_CONFIG_FILE, 'utf8')) }) :
    createSynology({ baseUrl: process.env.SURVEILLANCE_URL || '', username: secret('SS_USERNAME_FILE'),
      password: secret('SS_PASSWORD_FILE'), allowedIds: (process.env.CCTV_CAMERA_IDS || '').split(',').map(id => id.trim()).filter(Boolean) });
  const server = http.createServer(createHandler({ coreUrl: process.env.YUVOMI_INTERNAL_URL || 'http://tvceb:3000', synology,
    adminOnly: process.env.CCTV_ADMIN_ONLY !== 'false' }));
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(Number(process.env.PORT || 3020), '0.0.0.0', () => console.log('Read-only CCTV service ready.'));
  const shutdown = () => { synology.close?.(); server.close(); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
