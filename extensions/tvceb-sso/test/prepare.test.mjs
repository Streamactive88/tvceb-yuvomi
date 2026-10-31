import test from 'node:test';
import assert from 'node:assert/strict';
import {prepare} from '../prepare.mjs';
const fixture=()=>({brokerOrigin:'https://broker.test',upstream:{issuer:'https://nas.test/sso',authorizationEndpoint:'https://nas.test/auth',tokenEndpoint:'https://nas.test/token',userinfoEndpoint:'https://nas.test/userinfo',jwksUri:'https://nas.test/jwks',clientId:'fixture',clientSecret:'fixture-secret'},services:Object.fromEntries(['tvceb','photos','photoprism','vaultwarden','homeassistant'].map(id=>[id,`https://${id}.test`])),members:[{username:'parent1',upstreamSubject:'nas-subject-1',email:'parent1@family.test',emailVerifiedByAdmin:true,familyGroupVerifiedByAdmin:true}]});
test('broker prelinks exact verified identities, denies unknown users and disables unsafe grants',()=>{
  const result=prepare(fixture()),r=result.realm;
  assert.equal(r.registrationAllowed,false);assert.equal(r.resetPasswordAllowed,false);
  assert.deepEqual(r.users[0].federatedIdentities,[{identityProvider:'synology',userId:'nas-subject-1',userName:'parent1'}]);
  assert.deepEqual(r.users[0].credentials,[]);assert.deepEqual(r.users[0].groups,['/TVceb Family']);
  assert.equal(r.identityProviders[0].firstBrokerLoginFlowAlias,'family-deny-unlinked');assert.equal(r.authenticationFlows[0].authenticationExecutions[0].authenticator,'deny-access-authenticator');
  assert.equal(r.clients.find(c=>c.clientId==='account-console').enabled,false);
  for(const c of result.clients){assert.equal(c.directAccessGrantsEnabled,false);assert.equal(c.implicitFlowEnabled,false);assert.equal(c.attributes['pkce.code.challenge.method'],'S256');assert.ok(!c.redirectUris[0].includes('*'));}
  assert.equal(result.clients.find(c=>c.clientId==='homeassistant').publicClient,true);
});
test('incomplete, duplicated, service-account and insecure mappings fail closed',()=>{
  for(const change of [c=>c.members=[],c=>c.members[0].username='admin',c=>c.members[0].familyGroupVerifiedByAdmin=false,c=>c.members[0].emailVerifiedByAdmin=false,c=>c.members.push({...c.members[0]}),c=>c.upstream.clientSecret='REPLACE',c=>c.brokerOrigin='http://broker.test',c=>c.services.photos='https://photos.test/*']){const c=fixture();change(c);assert.throws(()=>prepare(c));}
});
