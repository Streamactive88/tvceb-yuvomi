import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFamilyProfile } from './policy.mjs';
const env = {TVCEB_SSO_ALLOWED_GROUPS:'Family', TVCEB_SSO_ALLOWED_USERNAMES:'parent,child',TVCEB_SSO_EMAIL_MAP:JSON.stringify({parent:'parent@example.test',child:'child@example.test'})};
test('SSO maps the approved identity to the existing ordinary account, ignoring provider email',()=>{
  assert.deepEqual(normalizeFamilyProfile({sub:'123',username:'child',groups:['Family'],email:'admin@example.test'},env), {sub:'123',username:'child',groups:['Family'],email:'child@example.test',name:'child'});
});
test('SSO rejects service users, missing or malformed groups, and missing account mappings',()=>{
  for(const p of [{username:'admin',groups:['Family']},{username:'child'},{username:'child',groups:'Family'},{username:'child',groups:['Other']}]) assert.throws(()=>normalizeFamilyProfile(p,env),/denied/);
  assert.throws(()=>normalizeFamilyProfile({username:'child',groups:['Family']},{...env,TVCEB_SSO_EMAIL_MAP:'{}'}),/denied/);
});
test('SSO fails closed without configuration or with invalid account mapping JSON',()=>{
  assert.throws(()=>normalizeFamilyProfile({username:'child',groups:['Family']},{}),/denied/);
  assert.throws(()=>normalizeFamilyProfile({username:'child',groups:['Family']},{...env,TVCEB_SSO_EMAIL_MAP:'broken'}),/configured/);
});
