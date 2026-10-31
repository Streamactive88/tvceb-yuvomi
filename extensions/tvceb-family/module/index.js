import { api } from '/api.js';
import { canAccessNavModule, isNavModuleReadOnly } from '/permissions.js';
import { esc } from '/utils/html.js';
import { renderPageHeader, renderPageTitle, renderPageBody } from '/utils/page-layout.js';
import { familyMarkHtml } from '/utils/family-portrait.js';

const item = (name, module, text) => ({ name, module, text, href: `/${module}` });
export const groups = [
  { name: 'Plan', links: [
    item('Tasks', 'tasks', 'See what needs doing.'), item('Calendar', 'calendar', 'See what is coming up.'),
    item('Rewards', 'rewards', 'Celebrate your progress.'), item('Notes', 'notes', 'Write down something to remember.'),
    item('Contacts', 'contacts', 'Find someone’s contact details.'), item('Schedule', 'schedule', 'Check the family schedule.'),
  ] },
  { name: 'Household', links: [
    item('Meals', 'meals', 'See what is for dinner.'), item('Recipes', 'recipes', 'Find something to cook.'),
    item('Shopping', 'shopping', 'Add groceries to the shared list.'), item('Pantry', 'pantry', 'Check what is in the kitchen.'),
    item('Housekeeping', 'housekeeping', 'See the household jobs.'), item('Waste collection', 'waste', 'Check which bin goes out next.'),
    item('Documents', 'documents', 'Find a family document.'), item('Inventory', 'inventory', 'Find things around the house.'),
  ] },
  { name: 'People', links: [item('Health', 'health', 'Keep track of health and wellbeing.'), item('Birthdays', 'birthdays', 'See whose birthday is next.')] },
  { name: 'Finance', links: [item('Budget', 'budget', 'Keep track of family spending.')] },
  { name: 'Family apps', links: [
    { name: 'Photo Album', text: 'Enjoy the family photos in Immich.', href: 'https://photos.example.invalid/albums', external: true },
    { name: 'Passwords', text: 'Open your family Vaultwarden vault.', href: 'https://vault.example.invalid', external: true },
    { name: 'Home Assistant', text: 'Open the home dashboard.', href: 'https://assistant.example.invalid', external: true },
  ] },
];
const settings = [
  { name: 'Family', text: 'Manage family members.', href: '/settings/admin/family' },
  { name: 'Reminders', text: 'Set up task reminders.', href: '/settings/modules/tasks?section=sync-reminders' },
  { name: 'API Tokens', text: 'Connect another app.', href: '/settings/admin/api' },
  { name: 'Backup', text: 'Save or restore family data.', href: '/settings/admin/backup' },
  { name: 'Member access', text: 'Choose what each family member can use.', href: '/settings/admin/permissions' },
];
export function visibleGroups(disabled = []) {
  const off = new Set(disabled);
  return groups.map(group => ({ ...group, links: group.links.filter(link =>
    !link.module || (!off.has(link.module) && canAccessNavModule(link.module)))
  })).filter(group => group.links.length);
}
const card = link => `<a class="family-app-link" href="${esc(link.href)}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ' data-family-link'}><strong>${esc(link.name)}${link.external ? ' ↗' : ''}</strong><span>${esc(link.text)}${link.module && isNavModuleReadOnly(link.module) ? ' · View only' : ''}</span></a>`;
const section = group => `<section aria-label="${esc(group.name)}"><h2 class="family-app-group">${esc(group.name)}</h2>${group.name === 'Household' ? '<p>Kitchen: Meals · Recipes · Shopping · Pantry</p>' : ''}<div class="family-app-links">${group.links.map(card).join('')}</div></section>`;
export async function render(container, { user, signal }) {
  container.replaceChildren();
  let disabled;
  try { disabled = (await api.get('/preferences')).data.disabled_modules ?? []; }
  catch {
    if (!signal?.aborted) container.insertAdjacentHTML('beforeend', renderPageHeader({ title: renderPageTitle('Family menu') }) + renderPageBody({ content: '<p>We could not load your family menu. Please try again.</p>' }));
    return;
  }
  if (signal?.aborted) return;
  const sections = visibleGroups(disabled);
  if (user?.role === 'admin') sections.push({ name: 'Settings', links: settings });
  container.insertAdjacentHTML('beforeend', renderPageHeader({ title: renderPageTitle('Family menu') }) + renderPageBody({ content: `<div class="family-app-intro"><span class="family-app-picture" data-family-mark>${familyMarkHtml()}</span><div><h2>What would you like to do?</h2><p>Choose a name below to get started.</p></div></div>${sections.map(section).join('')}` }));
  container.querySelectorAll('[data-family-link]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); window.yuvomi.navigate(link.getAttribute('href'));
    }, { signal });
  });
}
