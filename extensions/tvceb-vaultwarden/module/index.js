import { renderPageHeader, renderPageTitle, renderPageBody } from '/utils/page-layout.js';

export async function render(container) {
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', renderPageHeader({ title: renderPageTitle('Vaultwarden') }) + renderPageBody({ content: `
    <section aria-label="Family passwords">
      <h2>Family passwords</h2>
      <p>Open your vault to find or save a password.</p>
      <p><a class="btn btn--primary" href="https://vault.example.invalid/" target="_blank" rel="noopener noreferrer">Open Vaultwarden ↗</a></p>
      <p>Sign in with your existing vault account. Your passwords stay in Vaultwarden.</p>
    </section>` }));
}
