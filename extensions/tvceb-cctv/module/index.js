import { esc } from '/utils/html.js';
import { renderPageHeader, renderPageTitle, renderPageBody } from '/utils/page-layout.js';

const API = '/api/extensions/tvceb-cctv';
const asDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not display the camera image.'));
  reader.readAsDataURL(blob); // Core CSP allows data: images, not blob: URLs.
});

export async function render(container, { signal }) {
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', renderPageHeader({ title: renderPageTitle('CCTV Cameras') }) +
    renderPageBody({ content: `
      <section class="cctv-panel" aria-label="Camera viewer">
        <div class="cctv-toolbar">
          <div><span class="cctv-badge">View only</span><p class="cctv-description">Camera previews · refreshed snapshots</p></div>
          <div class="cctv-controls">
            <label class="sr-only" for="cctv-search">Find a camera</label><input class="input" id="cctv-search" type="search" placeholder="Find a camera…" />
            <label class="sr-only" for="cctv-interval">Refresh interval</label><select class="input" id="cctv-interval" aria-label="Refresh interval"><option value="2000">Every 2 seconds</option><option value="5000" selected>Every 5 seconds</option><option value="10000">Every 10 seconds</option></select>
            <button class="btn btn--secondary" id="cctv-pause" type="button" aria-pressed="false">Pause</button>
            <button class="btn btn--secondary" id="cctv-refresh" type="button">Refresh</button>
          </div>
        </div>
        <p id="cctv-status" class="cctv-status" role="status">Connecting to the camera service…</p>
        <div id="cctv-grid" class="cctv-grid"></div>
        <div id="cctv-empty" class="cctv-empty" hidden></div>
      </section>
      <dialog id="cctv-dialog" class="cctv-dialog"><div class="cctv-dialog-head"><h2 id="cctv-dialog-title"></h2><button class="btn btn--secondary" type="button" id="cctv-close">Close</button></div><img id="cctv-large" alt="" /></dialog>` }));
  const get = selector => container.querySelector(selector);
  const grid = get('#cctv-grid'); const status = get('#cctv-status'); const empty = get('#cctv-empty');
  const dialog = get('#cctv-dialog');
  let cameras = []; let timer; let busy = false; let paused = false; let interval = 5000; let selected;
  const cards = new Map();
  const showError = message => { status.textContent = message; status.classList.add('cctv-status--error'); };
  async function request(path) {
    const response = await fetch(API + path, { credentials: 'same-origin', cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || (response.status === 404 ? 'Camera service is not connected. Ask your administrator to complete setup.' : 'Could not load camera images.'));
    }
    return response;
  }
  const schedule = () => {
    clearTimeout(timer);
    if (!signal.aborted && !paused && !document.hidden) timer = setTimeout(refresh, interval);
  };
  async function update(camera) {
    const card = cards.get(camera.id);
    try {
      const response = await request(`/cameras/${camera.id}/snapshot`);
      const blob = await response.blob();
      if (blob.type !== 'image/jpeg') throw new Error('No image was returned by the camera.');
      const data = await asDataUrl(blob);
      if (signal.aborted) return;
      card.querySelector('img').src = data;
      card.querySelector('img').hidden = false;
      card.querySelector('.cctv-placeholder').hidden = true;
      card.querySelector('.cctv-camera-status').textContent = 'Updated ' + new Date().toLocaleTimeString();
      card.classList.remove('cctv-card--error');
      if (selected === camera.id && dialog.open) get('#cctv-large').src = data;
    } catch (error) {
      if (signal.aborted) return;
      card.querySelector('.cctv-camera-status').textContent = error.message;
      card.classList.add('cctv-card--error');
      // Do not leave an old frame looking current when a camera goes offline.
      card.querySelector('img').removeAttribute('src'); card.querySelector('img').hidden = true;
      card.querySelector('.cctv-placeholder').hidden = false;
      card.querySelector('.cctv-placeholder').textContent = 'Camera unavailable';
      if (selected === camera.id && dialog.open) { dialog.close(); selected = undefined; }
    }
  }
  async function refresh() {
    clearTimeout(timer);
    if (busy || signal.aborted || document.hidden) return;
    busy = true; get('#cctv-refresh').disabled = true;
    try {
      if (!cards.size) {
        const data = await (await request('/cameras')).json();
        if (signal.aborted) return;
        if (!data.configured) { empty.hidden = false; empty.textContent = 'Camera connection needs setup. Ask your administrator to connect the camera service.'; status.textContent = 'Not connected'; return; }
        get('.cctv-description').textContent = (data.source || 'Camera previews') + ' · refreshed snapshots';
        cameras = data.cameras;
        for (const camera of cameras) {
          const card = document.createElement('article'); card.className = 'cctv-card';
          card.insertAdjacentHTML('beforeend', `<button type="button" class="cctv-image-button" aria-label="Enlarge ${esc(camera.name)}"><span class="cctv-placeholder">Waiting for camera…</span><img alt="${esc(camera.name)} camera snapshot" hidden /></button><div class="cctv-card-footer"><h2>${esc(camera.name)}</h2><p class="cctv-camera-status">Loading image…</p></div>`);
          card.querySelector('button').addEventListener('click', () => {
            const image = card.querySelector('img'); if (image.hidden) return;
            selected = camera.id; get('#cctv-dialog-title').textContent = camera.name;
            get('#cctv-large').alt = camera.name + ' camera snapshot'; get('#cctv-large').src = image.src;
            dialog.showModal();
          }, { signal });
          cards.set(camera.id, card); grid.append(card);
        }
      }
      const query = get('#cctv-search').value.trim().toLowerCase();
      const visible = cameras.filter(camera => camera.name.toLowerCase().includes(query));
      for (const camera of cameras) cards.get(camera.id).hidden = !visible.includes(camera);
      empty.hidden = visible.length > 0;
      empty.textContent = cameras.length ? 'No cameras match your search.' : 'No cameras are available to the camera service.';
      for (let index = 0; index < visible.length; index += 4) {
        if (signal.aborted || document.hidden) break;
        await Promise.all(visible.slice(index, index + 4).map(update));
      }
      if (signal.aborted) return;
      status.classList.remove('cctv-status--error');
      status.textContent = paused ? 'Updates paused. Images are not live.' : `${visible.length} camera${visible.length === 1 ? '' : 's'} · updates every ${interval / 1000} seconds`;
    } catch (error) { if (!signal.aborted) showError(error.message); }
    finally { busy = false; if (!signal.aborted) get('#cctv-refresh').disabled = false; schedule(); }
  }
  get('#cctv-close').addEventListener('click', () => dialog.close(), { signal });
  get('#cctv-refresh').addEventListener('click', refresh, { signal });
  get('#cctv-search').addEventListener('input', refresh, { signal });
  get('#cctv-interval').addEventListener('change', event => { interval = Number(event.target.value); refresh(); }, { signal });
  get('#cctv-pause').addEventListener('click', event => {
    paused = !paused; event.currentTarget.textContent = paused ? 'Resume' : 'Pause';
    event.currentTarget.setAttribute('aria-pressed', String(paused));
    if (paused) { clearTimeout(timer); status.textContent = 'Updates paused. Images are not live.'; } else refresh();
  }, { signal });
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden && !paused) refresh(); }, { signal });
  signal.addEventListener('abort', () => { clearTimeout(timer); if (dialog.open) dialog.close(); }, { once: true });
  await refresh();
}
