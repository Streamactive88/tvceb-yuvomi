import { renderPageHeader, renderPageTitle, renderPageBody } from '/utils/page-layout.js';
import {esc} from '/utils/html.js';
import {familyContext} from '/api/v1/modules/assets/tvceb-family/client.js';

export async function render(container,{signal}) {
  container.replaceChildren();
  let url;
  try {url=(await familyContext(signal)).settings.services.vaultwarden;}catch { /* A parent can reconnect Family home. */ }
  if(signal?.aborted)return;
  container.insertAdjacentHTML('beforeend', renderPageHeader({ title: renderPageTitle('Vaultwarden') }) + renderPageBody({ content: `
    <section aria-label="Family passwords">
      <h2>Family passwords</h2>
      <p>Open your vault to find or save a password.</p>
      ${url?`<p><a class="btn btn--primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open Vaultwarden ↗</a></p>`:'<p>Ask a parent to connect the vault in Family setup.</p>'}
      <p>Use Family sign-in when it is available, then unlock with your vault master password. Your passwords stay in Vaultwarden.</p>
    </section>` }));
}
