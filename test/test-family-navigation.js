import test from 'node:test';
import assert from 'node:assert/strict';
import {simplifyFamilyNavigation} from '../public/utils/family-navigation.js';
test('simple menu retains family destinations, does not grant access, and falls back when Family home is absent',()=>{
  const items=['/','/tasks','/budget','/m/tvceb-family','/m/tvceb-knowledgebase','/settings'].map(path=>({path}));
  assert.deepEqual(simplifyFamilyNavigation(items,true).map(x=>x.path),['/','/tasks','/m/tvceb-family','/m/tvceb-knowledgebase','/settings']);
  assert.equal(simplifyFamilyNavigation(items,false),items);
  const noHome=items.filter(x=>x.path!=='/m/tvceb-family');assert.equal(simplifyFamilyNavigation(noHome,true),noHome);
});
