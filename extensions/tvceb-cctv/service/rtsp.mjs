import { spawn } from 'node:child_process';
import { CameraError } from './synology.mjs';

// Only a server-owned file supplies RTSP targets. HTTP callers supply a channel ID.
export function createRtsp({ config, allowedIds = [], maxStreams = 4, spawnProcess = spawn, idleMs = 30000, frameTimeoutMs = 20000 }) {
  if (!config || !Array.isArray(config.cameras)) throw new Error('RTSP configuration needs a cameras array.');
  if (!Number.isSafeInteger(maxStreams) || maxStreams < 1 || maxStreams > 32) throw Error('Invalid decoder limit.');
  if (!Array.isArray(allowedIds) || allowedIds.some(id => !/^(0|[1-9][0-9]*)$/.test(String(id)))) throw Error('Invalid camera allowlist.');
  const cameras = config.cameras.map(camera => {
    const url = new URL(camera.url);
    if (!['rtsp:', 'rtsps:'].includes(url.protocol) || !Number.isSafeInteger(camera.id) || camera.id < 0) throw new Error('Invalid RTSP camera configuration.');
    if (url.pathname === '/cam/realmonitor') url.searchParams.set('subtype', '1');
    return { id: camera.id, name: String(camera.name || `Channel ${camera.id}`).slice(0, 160), url: url.href };
  });
  if (cameras.length > 32 || new Set(cameras.map(camera => camera.id)).size !== cameras.length) throw new Error('Use at most 32 distinct camera IDs.');
  const visibleCameras = allowedIds.length ? cameras.filter(camera => allowedIds.map(String).includes(String(camera.id))) : cameras;
  const streams = new Map();
  function start(camera) {
    if (streams.size >= maxStreams) {
      const idle = [...streams.entries()].find(([,state]) => state.waiters.size === 0);
      if (!idle) throw new CameraError('Camera previews are busy. Try again shortly.', 503);
      const [oldId, old] = idle;
      clearTimeout(old.idle);
      for (const waiter of old.waiters) waiter.reject(new CameraError('Camera preview paused. Try again.', 503));
      old.waiters.clear(); streams.delete(oldId); old.process.kill('SIGKILL');
    }
    const state = { bytes: null, time: 0, buffer: Buffer.alloc(0), waiters: new Set(), idle: null, stopped: false };
    const process = spawnProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-rtsp_transport', 'tcp',
      '-timeout', '12000000', '-threads', '1', '-i', camera.url, '-an', '-sn', '-dn', '-filter_threads', '1',
      '-vf', 'fps=1/2,scale=w=960:h=-2:force_original_aspect_ratio=decrease',
      '-threads', '1', '-q:v', '5', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'], { stdio: ['ignore', 'pipe', 'ignore'] });
    state.process = process;
    const failed = () => {
      state.stopped = true; clearTimeout(state.idle);
      if (streams.get(camera.id) === state) streams.delete(camera.id);
      for (const waiter of state.waiters) waiter.reject(new CameraError('Camera unavailable. Check its RTSP connection and channel.'));
      state.waiters.clear();
    };
    process.on('error', failed);
    process.on('exit', failed);
    process.stdout.on('data', chunk => {
      state.buffer = Buffer.concat([state.buffer, chunk]);
      if (state.buffer.length > 8 * 1024 * 1024) { process.kill('SIGKILL'); return; }
      for (;;) {
        const begin = state.buffer.indexOf(Buffer.from([0xff, 0xd8]));
        if (begin < 0) { state.buffer = state.buffer.subarray(Math.max(0, state.buffer.length - 1)); break; }
        const end = state.buffer.indexOf(Buffer.from([0xff, 0xd9]), begin + 2);
        if (end < 0) { state.buffer = state.buffer.subarray(begin); break; }
        state.bytes = Buffer.from(state.buffer.subarray(begin, end + 2)); state.time = Date.now();
        state.buffer = state.buffer.subarray(end + 2);
        for (const waiter of state.waiters) waiter.resolve({ bytes: state.bytes, time: state.time });
        state.waiters.clear();
      }
    });
    streams.set(camera.id, state);
    return state;
  }
  async function snapshot(id) {
    const camera = visibleCameras.find(camera => camera.id === id);
    if (!camera) throw new CameraError('Camera not found.', 404);
    const state = streams.get(id) || start(camera);
    clearTimeout(state.idle);
    state.idle = setTimeout(() => { state.process.kill('SIGKILL'); }, idleMs);
    state.idle.unref?.();
    if (state.bytes && Date.now() - state.time < 6000) return { bytes: state.bytes, time: state.time };
    return new Promise((resolve, reject) => {
      const waiter = { resolve: frame => { clearTimeout(timer); resolve(frame); }, reject: error => { clearTimeout(timer); reject(error); } };
      const timer = setTimeout(() => { state.waiters.delete(waiter); reject(new CameraError('Camera did not return an image in time.')); }, frameTimeoutMs);
      state.waiters.add(waiter);
    });
  }
  function close() {
    for (const state of streams.values()) { clearTimeout(state.idle); state.process.kill('SIGKILL'); }
    streams.clear();
  }
  return { ready: visibleCameras.length > 0, source: 'RTSP cameras', list: async () => visibleCameras.map(({ id, name }) => ({ id, name })), snapshot, close };
}
