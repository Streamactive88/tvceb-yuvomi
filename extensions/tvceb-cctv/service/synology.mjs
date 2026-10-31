export class CameraError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

export function createSynology({ baseUrl, username, password, fetcher = fetch, allowedIds = [] }) {
  let sid;
  let loginPending;
  let cameras;
  let listPending;
  let listedAt = 0;
  let loginBlockedUntil = 0;
  const frames = new Map();
  const pendingFrames = new Map();
  const ready = !!(baseUrl && username && password);
  if (baseUrl) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('SURVEILLANCE_URL must be an HTTP(S) origin without credentials or a path.');
    }
  }
  async function request(fields, authenticated = true) {
    if (!ready) throw new CameraError('Surveillance Station connection is not configured.', 503);
    if (authenticated) await login();
    const body = new URLSearchParams(fields);
    if (authenticated) body.set('_sid', sid);
    try {
      const response = await fetcher(new URL('/webapi/' + (authenticated ? 'entry.cgi' : 'auth.cgi'), baseUrl), {
        method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new CameraError('Surveillance Station is unavailable.');
      return response;
    } catch (error) {
      if (error instanceof CameraError) throw error;
      throw new CameraError('Cannot reach Surveillance Station. Check its URL and trusted TLS certificate.');
    }
  }
  async function login() {
    if (sid) return;
    if (Date.now() < loginBlockedUntil) throw new CameraError('Surveillance Station login failed. Check the dedicated viewer account.', 503);
    if (!loginPending) loginPending = (async () => {
      const response = await request({ api: 'SYNO.API.Auth', method: 'Login', version: '6', account: username,
        passwd: password, session: 'SurveillanceStation', format: 'sid' }, false);
      const data = await response.json();
      if (!data.success || !data.data?.sid) {
        loginBlockedUntil = Date.now() + 60000;
        throw new CameraError('Surveillance Station login failed. Check the dedicated viewer account.', 503);
      }
      sid = data.data.sid;
    })().finally(() => { loginPending = null; });
    await loginPending;
  }
  async function cameraRequest(method, parameters = {}, retry = true) {
    // This is an explicit allowlist; browser input never selects an upstream method.
    if (!['List', 'GetSnapshot'].includes(method)) throw new CameraError('Operation is not allowed.', 405);
    const response = await request({ api: 'SYNO.SurveillanceStation.Camera', version: '9', method, ...parameters });
    if (response.headers.get('content-type')?.split(';')[0] === 'image/jpeg') return response;
    const data = await response.json();
    if (!data.success) {
      if ([106, 107, 119].includes(data.error?.code) && retry) {
        sid = undefined;
        return cameraRequest(method, parameters, false);
      }
      throw new CameraError('Surveillance Station denied camera access. Check viewer permissions.');
    }
    return data.data;
  }
  async function list() {
    if (cameras && Date.now() - listedAt < 10000) return cameras;
    if (!listPending) listPending = (async () => {
      const data = await cameraRequest('List', { privCamType: '1', camStm: '0', limit: '1000', offset: '0' });
      if (!Array.isArray(data?.cameras)) throw new CameraError('Invalid camera list returned by Surveillance Station.');
      cameras = data.cameras.filter(camera => Number.isSafeInteger(camera.id) && camera.id >= 0 &&
        (!allowedIds.length || allowedIds.includes(String(camera.id)))).map(camera => ({
        id: camera.id, name: String(camera.name || `Camera ${camera.id}`).slice(0, 160),
      }));
      listedAt = Date.now();
      for (const id of frames.keys()) if (!cameras.some(camera => camera.id === id)) frames.delete(id);
      return cameras;
    })().finally(() => { listPending = null; });
    return listPending;
  }
  async function snapshot(id) {
    if (!(await list()).some(camera => camera.id === id)) throw new CameraError('Camera not found.', 404);
    const cached = frames.get(id);
    if (cached && Date.now() - cached.time < 1500) return cached;
    if (!pendingFrames.has(id)) pendingFrames.set(id, (async () => {
      const response = await cameraRequest('GetSnapshot', { id: String(id), profileType: '1' });
      if (!(response instanceof Response)) throw new CameraError('No camera image was returned.');
      const reader = response.body.getReader();
      const chunks = []; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length;
          if (size > 5 * 1024 * 1024) throw new CameraError('Camera image is too large.');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const bytes = Buffer.concat(chunks);
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new CameraError('Invalid camera image.');
      const frame = { bytes, time: Date.now() };
      frames.set(id, frame);
      return frame;
    })().finally(() => pendingFrames.delete(id)));
    return pendingFrames.get(id);
  }
  return { list, snapshot, ready };
}
