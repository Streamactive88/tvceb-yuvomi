import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHandler, PREFIX } from '../service/server.mjs';
import { createSynology } from '../service/synology.mjs';
import { createRtsp } from '../service/rtsp.mjs';
import { EventEmitter } from 'node:events';

test('RTSP allowlist hides and denies other channels and forces the recorder substream', async () => {
  let child;
  const camera=createRtsp({config:{cameras:[1,2].map(id=>({id,url:`rtsp://viewer:fixture@192.0.2.1/cam/realmonitor?channel=${id}&subtype=0`}))},allowedIds:['2'],spawnProcess:(command,args)=>{
    const input=new URL(args[args.indexOf('-i')+1]);assert.equal(input.searchParams.get('subtype'),'1');
    child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>child.emit('exit',0);return child;
  }});
  assert.deepEqual((await camera.list()).map(c=>c.id),[2]);
  await assert.rejects(camera.snapshot(1),e=>e.status===404);
  const result=camera.snapshot(2);child.stdout.emit('data',Buffer.from([0xff,0xd8,0xff,0xd9]));await result;camera.close();
});

test('RTSP decoder limit does not interrupt pending snapshots', async () => {
  const children=[];
  const camera=createRtsp({config:{cameras:[1,2,3].map(id=>({id,url:`rtsp://192.0.2.1/stream/${id}`}))},maxStreams:2,spawnProcess:()=>{
    const child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>child.emit('exit',0);children.push(child);return child;
  }});
  const first=camera.snapshot(1),second=camera.snapshot(2);
  await assert.rejects(camera.snapshot(3),e=>e.status===503);assert.equal(children.length,2);
  for(const child of children)child.stdout.emit('data',Buffer.from([0xff,0xd8,0xff,0xd9]));
  await Promise.all([first,second]);
  const third=camera.snapshot(3);children[2].stdout.emit('data',Buffer.from([0xff,0xd8,0xff,0xd9]));await third;camera.close();
});

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

async function fixture(t, { role = 'admin', access = 'write', enabled = true, valid = true, adminOnly = true, ready = true } = {}) {
  let coreCalls = 0; let snapshots = 0;
  const synology = { ready, list: async () => [{ id: 1, name: 'Front <door>' }], snapshot: async () => { snapshots++; return { bytes: jpeg, time: Date.now() }; } };
  const handler = createHandler({ coreUrl: 'http://core', synology, adminOnly, fetcher: async (url, options) => {
    coreCalls++;
    assert.equal(options.headers.cookie, 'yuvomi.sid=fixture');
    if (!valid) return json({}, 401);
    return url.pathname.endsWith('/me') ? json({ user: { id: 1, role }, permissions: { modules: { 'ext:tvceb-cctv': access } } }) :
      json({ data: [{ id: 'tvceb-cctv', enabled }] });
  } });
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return { request: (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    headers: { cookie: 'yuvomi.sid=fixture; unrelated=not-forwarded' }, ...options }), counts: () => ({ coreCalls, snapshots }) };
}

test('requires a valid session and fails closed on permissions and disabled modules', async t => {
  const anonymous = await fixture(t);
  assert.equal((await anonymous.request(PREFIX + '/cameras', { headers: {} })).status, 401);
  for (const config of [{ valid: false }, { access: 'none' }, { access: undefined }, { enabled: false }, { role: 'member' }]) {
    // Explicit missing permission, rather than the fixture's default.
    if ('access' in config && config.access === undefined) config.access = null;
    const f = await fixture(t, config);
    assert.equal((await f.request(PREFIX + '/cameras')).status, config.valid === false ? 401 : 403);
    assert.equal(f.counts().snapshots, 0);
  }
});

test('read access can view images, session lookup is cached, responses never cache images', async t => {
  const f = await fixture(t, { role: 'member', access: 'read', adminOnly: false });
  const response = await f.request(PREFIX + '/cameras/1/snapshot');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg);
  assert.equal((await f.request(PREFIX + '/cameras')).status, 200);
  assert.equal(f.counts().coreCalls, 2);
});

test('every mutating method is rejected, and no arbitrary proxy route is provided', async t => {
  const f = await fixture(t);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await f.request(PREFIX + '/cameras', { method })).status, 405);
  assert.equal((await f.request(PREFIX + '/webapi/entry.cgi?method=Delete')).status, 404);
  assert.equal((await f.request(PREFIX + '/cameras/../../etc/passwd')).status, 404);
  assert.equal(f.counts().snapshots, 0);
});

test('unconfigured service shows setup state without requesting camera data', async t => {
  const f = await fixture(t, { ready: false });
  assert.deepEqual(await (await f.request(PREFIX + '/cameras')).json(), { configured: false, source: 'Synology Surveillance Station', cameras: [] });
});

test('Synology adapter permits only listing and snapshots, hides credentials and checks camera IDs', async () => {
  const calls = [];
  const camera = createSynology({ baseUrl: 'https://nas:5001', username: 'viewer', password: 'FixtureOnly!@#&+', allowedIds: ['3'], fetcher: async (url, options) => {
    const body = Object.fromEntries(options.body);
    assert.equal(url.search, ''); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
    calls.push(body);
    if (body.api === 'SYNO.API.Auth') return json({ success: true, data: { sid: 'secret-sid' } });
    assert.equal(body._sid, 'secret-sid');
    if (body.method === 'List') return json({ success: true, data: { cameras: [{ id: 3, name: 'Gate', password: 'must-never-leak' }, { id: 4, name: 'Private' }] } });
    assert.equal(body.method, 'GetSnapshot'); assert.equal(body.id, '3');
    return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } });
  } });
  assert.deepEqual(await camera.list(), [{ id: 3, name: 'Gate' }]);
  await assert.rejects(camera.snapshot(4), /Camera not found/);
  assert.deepEqual((await camera.snapshot(3)).bytes, jpeg);
  await camera.snapshot(3);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].passwd, 'FixtureOnly!@#&+');
});

test('expired Surveillance Station session retries once and invalid images are rejected', async () => {
  let logins = 0; let lists = 0;
  const camera = createSynology({ baseUrl: 'https://nas', username: 'viewer', password: 'fixture', fetcher: async (_url, options) => {
    const body = Object.fromEntries(options.body);
    if (body.method === 'Login') { logins++; return json({ success: true, data: { sid: 'sid' + logins } }); }
    if (body.method === 'List') {
      if (++lists === 1) return json({ success: false, error: { code: 106 } });
      return json({ success: true, data: { cameras: [{ id: 1, name: 'Gate' }] } });
    }
    return new Response('not a jpeg', { headers: { 'content-type': 'image/jpeg' } });
  } });
  await camera.list(); assert.equal(logins, 2);
  await assert.rejects(camera.snapshot(1), /Invalid camera image/);
});

test('bad credentials are not retried on every camera refresh', async () => {
  let logins = 0;
  const camera = createSynology({ baseUrl: 'https://nas', username: 'viewer', password: 'fixture', fetcher: async () => { logins++; return json({ success: false }); } });
  await assert.rejects(camera.list(), /login failed/);
  await assert.rejects(camera.list(), /login failed/);
  assert.equal(logins, 1);
});

test('RTSP viewer shares decoding, parses split frames, hides URLs and stops idle streams', async () => {
  let child; let spawns = 0; let killed = false;
  const camera = createRtsp({ config: { cameras: [{ id: 1, name: 'Channel 1', url: 'rtsp://viewer:fixture@192.0.2.1:554/cam/realmonitor?channel=1&subtype=1' }] }, idleMs: 20,
    spawnProcess: (command, args) => {
      assert.equal(command, 'ffmpeg'); assert.ok(args.includes('-an')); assert.ok(args.includes('image2pipe'));
      child = new EventEmitter(); child.stdout = new EventEmitter(); child.kill = () => { killed = true; child.emit('exit', 0); };
      spawns++; return child;
    } });
  assert.deepEqual(await camera.list(), [{ id: 1, name: 'Channel 1' }]);
  await assert.rejects(camera.snapshot(2), /Camera not found/);
  const first = camera.snapshot(1); const second = camera.snapshot(1);
  child.stdout.emit('data', jpeg.subarray(0, 1)); child.stdout.emit('data', jpeg.subarray(1));
  assert.deepEqual((await first).bytes, jpeg); assert.deepEqual((await second).bytes, jpeg);
  await camera.snapshot(1); assert.equal(spawns, 1);
  await new Promise(resolve => setTimeout(resolve, 35)); assert.equal(killed, true); camera.close();
});

test('RTSP failure returns a safe error without leaking credentials', async () => {
  let child;
  const camera = createRtsp({ config: { cameras: [{ id: 1, url: 'rtsp://viewer:never-disclose@192.0.2.1/stream' }] }, spawnProcess: () => {
    child = new EventEmitter(); child.stdout = new EventEmitter(); child.kill = () => {}; return child;
  } });
  const result = camera.snapshot(1); child.emit('error', new Error('rtsp://viewer:never-disclose@192.0.2.1'));
  await assert.rejects(result, error => error.message.includes('Camera unavailable') && !error.message.includes('never-disclose'));
  camera.close();
});
