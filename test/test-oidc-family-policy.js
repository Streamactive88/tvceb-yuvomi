import test from 'node:test';
import assert from 'node:assert/strict';
import { oidcIdentityAllowed, requestedOidcScope, oidcProfileEmail } from '../server/services/oidc.js';
const keys = ['OIDC_ALLOWED_GROUPS', 'OIDC_ALLOWED_USERNAMES', 'OIDC_SCOPES', 'OIDC_USE_PROVIDER_EMAIL', 'OIDC_ISSUER'];
const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
test.after(() => { for (const k of keys) if (original[k] === undefined) delete process.env[k]; else process.env[k] = original[k]; });
test('SSO family policy requires the exact group and allowed person', () => {
  process.env.OIDC_ALLOWED_GROUPS = 'TVceb FamilyGroup';
  process.env.OIDC_ALLOWED_USERNAMES = 'parent1,child1';
  assert.equal(oidcIdentityAllowed({}, {username:'child1',groups:['TVceb FamilyGroup']}), true);
  for (const info of [{username:'service',groups:['TVceb FamilyGroup']},{username:'child1'},{username:'child1',groups:'TVceb FamilyGroup'},{username:'child1',groups:['TVceb FamilyGroup-other']}]) assert.equal(oidcIdentityAllowed({}, info),false);
  assert.equal(oidcIdentityAllowed({groups:['TVceb FamilyGroup']}, {username:'child1',groups:[]}),false);
  assert.equal(oidcIdentityAllowed({username:'parent1',groups:['TVceb FamilyGroup']}, {}),true);
});
test('Synology scope excludes unsupported profile and includes groups', () => {
  process.env.OIDC_SCOPES = 'openid email';
  assert.equal(requestedOidcScope(),'openid email groups');
  process.env.OIDC_SCOPES = 'email';
  assert.throws(requestedOidcScope,/openid/);
});
test('a shared NAS email cannot match an existing account when provider email use is disabled', () => {
  process.env.OIDC_USE_PROVIDER_EMAIL = 'false';
  assert.equal(oidcProfileEmail({email:'admin@example.test'}), undefined);
  delete process.env.OIDC_USE_PROVIDER_EMAIL;
  assert.equal(oidcProfileEmail({email:'member@example.test'}), 'member@example.test');
});

test('family SSO denies missing person allowlist and treats a spaced group as one exact name', () => {
  process.env.OIDC_ISSUER='https://login.example.invalid/webman/sso';
  process.env.OIDC_ALLOWED_GROUPS='TVceb FamilyGroup';
  delete process.env.OIDC_ALLOWED_USERNAMES;
  const claims={username:'parent1',groups:['TVceb FamilyGroup']};
  assert.equal(oidcIdentityAllowed(claims,{}),false);
  process.env.OIDC_ALLOWED_USERNAMES='parent1';
  assert.equal(oidcIdentityAllowed(claims,{}),true);
  assert.equal(oidcIdentityAllowed({...claims,groups:['TVceb','FamilyGroup']},{}),false);
  delete process.env.OIDC_ALLOWED_GROUPS;
  assert.equal(oidcIdentityAllowed(claims,{}),false);
});
