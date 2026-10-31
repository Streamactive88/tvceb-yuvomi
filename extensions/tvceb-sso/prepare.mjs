import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const secret=()=>randomBytes(36).toString('base64url');
const https=value=>{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||u.hostname.endsWith('.invalid'))throw Error('Supply real private HTTPS URLs without credentials.');return u.href.replace(/\/$/,'');};
export function prepare(config){
  const origin=https(config.brokerOrigin);if(new URL(origin).pathname!=='/')throw Error('Broker must use its own HTTPS origin.');
  const up=config.upstream;for(const key of ['issuer','authorizationEndpoint','tokenEndpoint','userinfoEndpoint','jwksUri'])https(up[key]);
  for(const key of ['clientId','clientSecret'])if(!up[key]||up[key]==='REPLACE')throw Error('Register a dedicated NAS OIDC client first.');
  if(!Array.isArray(config.members)||!config.members.length)throw Error('Explicit family identity mappings are required.');
  const seen={username:new Set(),upstreamSubject:new Set(),email:new Set()};
  for(const m of config.members){
    if(!/^[a-zA-Z0-9._-]{1,80}$/.test(m.username)||/^(admin|root|maestro|mqtt_manager)$/i.test(m.username))throw Error('Only named human family accounts may be linked.');
    if(!m.upstreamSubject||m.upstreamSubject==='REPLACE'||!m.emailVerifiedByAdmin||!m.familyGroupVerifiedByAdmin||!/^\S+@\S+\.\S+$/.test(m.email)||m.email.endsWith('.invalid'))throw Error('Verify each NAS subject, family membership and unique service email privately.');
    for(const key of Object.keys(seen)){const value=String(m[key]).toLowerCase();if(seen[key].has(value))throw Error('Identity mappings must be unique.');seen[key].add(value);}
  }
  const callbacks={tvceb:'/api/v1/auth/oidc/callback',photos:'/users/auth/openid_connect/callback',photoprism:'/api/v1/oidc/redirect',vaultwarden:'/identity/connect/oidc-signin',homeassistant:'/auth/oidc/callback'};
  const clients=Object.entries(callbacks).map(([id,callback])=>{const service=https(config.services[id]);if(new URL(service).pathname!=='/')throw Error('Services must use separate origins.');return{clientId:id,name:id,enabled:true,protocol:'openid-connect',publicClient:id==='homeassistant',secret:id==='homeassistant'?undefined:secret(),standardFlowEnabled:true,implicitFlowEnabled:false,directAccessGrantsEnabled:false,serviceAccountsEnabled:false,redirectUris:[service+callback],webOrigins:[service],defaultClientScopes:['profile','email','groups'],optionalClientScopes:[],attributes:{'pkce.code.challenge.method':'S256'},protocolMappers:[]};});
  const users=config.members.map(m=>({id:randomUUID(),username:m.username.toLowerCase(),enabled:true,email:m.email,emailVerified:true,groups:['/TVceb Family'],requiredActions:[],credentials:[],federatedIdentities:[{identityProvider:'synology',userId:m.upstreamSubject,userName:m.username}]}));
  const realm={realm:'tvceb-family',displayName:'TVceb Family',enabled:true,sslRequired:'all',registrationAllowed:false,resetPasswordAllowed:false,editUsernameAllowed:false,loginWithEmailAllowed:false,duplicateEmailsAllowed:false,bruteForceProtected:true,revokeRefreshToken:true,refreshTokenMaxReuse:0,accessTokenLifespan:300,ssoSessionIdleTimeout:1800,ssoSessionMaxLifespan:43200,
    groups:[{name:'TVceb Family'}],users,
    clients:[...clients,{clientId:'account',enabled:false},{clientId:'account-console',enabled:false}],
    clientScopes:[
      ...[['profile',[['username','preferred_username','String']]],['email',[['email','email','String'],['emailVerified','email_verified','boolean']]]].map(([name,claims])=>({name,protocol:'openid-connect',attributes:{'include.in.token.scope':'true'},protocolMappers:claims.map(([property,claim,type])=>({name:claim,protocol:'openid-connect',protocolMapper:'oidc-usermodel-property-mapper',config:{'user.attribute':property,'claim.name':claim,'jsonType.label':type,'id.token.claim':'true','access.token.claim':'true','userinfo.token.claim':'true'}}))})),
      {name:'groups',protocol:'openid-connect',attributes:{'include.in.token.scope':'true'},protocolMappers:[{name:'family-group',protocol:'openid-connect',protocolMapper:'oidc-group-membership-mapper',config:{'claim.name':'groups','full.path':'false','id.token.claim':'true','access.token.claim':'true','userinfo.token.claim':'true'}}]}
    ],
    authenticationFlows:[{alias:'family-deny-unlinked',description:'Only administrator-prelinked NAS subjects may sign in',providerId:'basic-flow',topLevel:true,builtIn:false,authenticationExecutions:[{authenticator:'deny-access-authenticator',requirement:'REQUIRED',priority:0,userSetupAllowed:false,authenticatorFlow:false}]}],
    identityProviders:[{alias:'synology',displayName:'Family NAS sign-in',providerId:'oidc',enabled:true,trustEmail:false,storeToken:false,linkOnly:false,firstBrokerLoginFlowAlias:'family-deny-unlinked',config:{clientId:up.clientId,clientSecret:up.clientSecret,issuer:up.issuer,authorizationUrl:up.authorizationEndpoint,tokenUrl:up.tokenEndpoint,userInfoUrl:up.userinfoEndpoint,jwksUrl:up.jwksUri,useJwksUrl:'true',validateSignature:'true',disableUserInfo:'false',defaultScope:'openid email groups',syncMode:'IMPORT',pkceEnabled:'true',pkceMethod:'S256'}}]};
  return{realm,issuer:origin+'/realms/tvceb-family',clients,users};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [input,out]=process.argv.slice(2);if(!input||!out)throw Error('Usage: node prepare.mjs PRIVATE_CONFIG NEW_PRIVATE_DIRECTORY');
  const result=prepare(JSON.parse(fs.readFileSync(input,'utf8')));fs.mkdirSync(out,{recursive:false,mode:0o700});
  const write=(name,value)=>fs.writeFileSync(path.join(out,name),value,{flag:'wx',mode:0o600});
  write('tvceb-family-realm.json',JSON.stringify(result.realm,null,2)+'\n');
  write('client-settings.json',JSON.stringify({issuer:result.issuer,clients:result.clients.map(c=>({id:c.clientId,secret:c.secret,redirect:c.redirectUris[0]})),photoSubjects:result.users.map(u=>({subject:u.id,username:u.username,email:u.email}))},null,2)+'\n');
  write('postgres-password',secret());write('bootstrap-password',secret());
  console.log('Private initial import and client mappings prepared. No services or accounts changed.');
}
