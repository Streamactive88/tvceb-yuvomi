import test from 'node:test';
import assert from 'node:assert/strict';
import { setPermissions } from '../public/permissions.js';
import { visibleGroups, render } from '../extensions/tvceb-family/module/index.js';

test('family menu respects member permissions and household module switches', () => {
  setPermissions({ modules: { budget: 'none', calendar: 'none', meals: 'read' } });
  const links = visibleGroups(['inventory', 'waste']).flatMap(g => g.links);
  assert.ok(!links.some(l => ['budget', 'calendar', 'birthdays', 'inventory', 'waste'].includes(l.module)));
  assert.ok(links.some(l => l.module === 'meals'));
  assert.ok(links.some(l => l.module === 'recipes'));
  assert.ok(links.some(l => l.module === 'shopping'));
});

test('family menu keeps administration away from children and labels view-only access', async () => {
  setPermissions({ modules: { meals: 'read' } });
  globalThis.__apiStub = { get: async () => ({ data: { disabled_modules: [] } }) };
  let html = '';
  const container = { replaceChildren() {}, insertAdjacentHTML(_, value) { html += value; }, querySelectorAll() { return []; } };
  await render(container, { user: { role: 'user', family_role: 'child' } });
  assert.ok(html.includes('View only'));
  assert.ok(!html.includes('/settings/admin/'));
  assert.ok(html.includes('noopener noreferrer'));
  html = '';
  await render(container, { user: { role: 'admin' } });
  assert.ok(html.includes('/settings/admin/permissions'));
  delete globalThis.__apiStub;
});
