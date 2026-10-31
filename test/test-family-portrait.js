import test from 'node:test';
import assert from 'node:assert/strict';
import { familyMarkHtml } from '../public/utils/family-portrait.js';
test('a clean source build has a built-in brand fallback without a private image', () => {
  const html=familyMarkHtml();assert.match(html,/<svg/);assert.doesNotMatch(html,/<img/);
});
