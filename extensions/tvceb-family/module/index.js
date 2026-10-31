import { esc } from '/utils/html.js';
import { renderPageHeader, renderPageTitle, renderPageBody } from '/utils/page-layout.js';

const links = [
  { name: 'Groceries', text: 'The shared family shopping list.', href: '/shopping' },
  { name: 'Documents', text: 'Keep family documents together.', href: '/documents' },
  { name: 'Kitchen', text: 'Meals, recipes, shopping and pantry.', href: '/meals' },
  { name: 'Immich Photo Album', text: 'Browse family photos and albums.', href: 'https://photos.int.s8.net.au/albums', external: true },
  { name: 'Family Vault', text: 'Open Vaultwarden to manage your passwords.', href: 'https://vault.int.s8.net.au', external: true },
  { name: 'Home Assistant', text: 'Open your home dashboard.', href: 'http://192.168.8.20:8123', external: true },
];
const settings = [
  { name: 'Family', text: 'Family members and roles.', href: '/settings/admin/family' },
  { name: 'Reminders', text: 'Tasks and reminder synchronisation.', href: '/settings/modules/tasks?section=sync-reminders' },
  { name: 'API Tokens', text: 'Manage access for integrations.', href: '/settings/admin/api' },
  { name: 'Backup', text: 'Back up and restore family data.', href: '/settings/admin/backup' },
];
const card = link => `<a class="family-app-link" href="${esc(link.href)}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ' data-family-link'}><strong>${esc(link.name)}${link.external ? ' ↗' : ''}</strong><span>${esc(link.text)}</span></a>`;

export function render(container, { user, signal }) {
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', renderPageHeader({ title: renderPageTitle('Family Apps') }) +
    renderPageBody({ content: `<section aria-label="Family apps"><div class="family-app-intro"><img src="/assets/family/family.png" width="1402" height="1122" alt="Family illustration" /><div><h2>Our family, together</h2><p>Your shopping, documents, photos and home tools in one place. Each connected app keeps its own secure sign-in.</p></div></div><div class="family-app-links">${links.map(card).join('')}</div>${user?.role === 'admin' ? `<h2 class="family-app-group">Settings</h2><div class="family-app-links">${settings.map(card).join('')}</div>` : ''}</section>` }));
  container.querySelectorAll('[data-family-link]').forEach(link => {
    link.addEventListener('click', event => { event.preventDefault(); window.yuvomi.navigate(link.getAttribute('href')); }, { signal });
  });
}
