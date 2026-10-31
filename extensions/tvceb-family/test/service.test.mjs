import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {openStore,createHandler,validateSettings,PREFIX} from '../service/server.mjs';

async function fixture(t,editing='parents'){
  const users={admin:{id:1,role:'admin',family_role:'parent'},parent:{id:2,role:'member',family_role:'mom'},child:{id:3,role:'member',family_role:'child'},other:{id:4,role:'member',family_role:'child'}};
  const db=openStore();let disabled=false,access='write';
  const fetcher=async(url,options)=>{
    if(new URL(url).pathname.endsWith('/auth/me')){
      const name=options.headers.cookie.split('=')[1];
      if(!users[name])return new Response('{}',{status:401});
      return Response.json({user:users[name],permissions:{modules:{'ext:tvceb-family':'write','ext:tvceb-knowledgebase':access,'ext:tvceb-whatsapp':'write'}}});
    }
    return Response.json({data:['tvceb-family','tvceb-knowledgebase','tvceb-whatsapp'].map(id=>({id,enabled:!disabled,error:null}))});
  };
  const server=http.createServer((req,res)=>handler(req,res));let handler;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  handler=createHandler({db,coreUrl:'http://core',publicOrigin:origin,secure:false,fetcher,cacheMs:0,initialSettings:{knowledgebaseEditing:editing}});
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();});
  const call=async(name,path,{method='GET',body,token,requestOrigin=origin}={})=>{
    const headers={Cookie:'yuvomi.sid='+name};if(token){headers.Cookie+='; tvceb_family_csrf='+token;headers['X-Family-CSRF']=token;}
    if(method!=='GET'){headers.Origin=requestOrigin;headers['Content-Type']='application/json';}
    const response=await fetch(origin+PREFIX+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    return{status:response.status,body:await response.json()};
  };
  const context=async name=>(await call(name,'/context')).body;
  return{call,context,setDisabled:v=>{disabled=v;},setAccess:v=>{access=v;}};
}
test('session, module state, origin and independent CSRF are enforced',async t=>{
  const f=await fixture(t);assert.equal((await f.call('anonymous','/context')).status,401);
  const c=await f.context('child');assert.equal(c.canSubmit,true);assert.equal(c.canEdit,false);
  const article={title:'A family tip',body:'Helpful content'};
  assert.equal((await f.call('child','/articles',{method:'POST',body:article})).status,403);
  assert.equal((await f.call('child','/articles',{method:'POST',body:article,token:c.csrf,requestOrigin:'https://elsewhere.example'})).status,403);
  f.setDisabled(true);assert.equal((await f.call('child','/articles')).status,403);
  f.setDisabled(false);f.setAccess('read');assert.equal((await f.call('child','/articles',{method:'POST',body:article,token:c.csrf})).status,403);
});
test('children submit drafts, parents publish/edit, and unrelated drafts remain private',async t=>{
  const f=await fixture(t),child=await f.context('child'),parent=await f.context('parent');
  const created=await f.call('child','/articles',{method:'POST',token:child.csrf,body:{title:'My new guide',body:'How I organise my school bag.',status:'published',author_id:1}});
  assert.equal(created.status,201);assert.equal(created.body.data.status,'pending');assert.equal(created.body.data.author_id,3);
  const row=created.body.data,path='/articles/'+row.id;
  assert.equal((await f.call('other',path)).status,404);assert.deepEqual((await f.call('other','/articles')).body.data,[]);
  assert.equal((await f.call('child',path,{method:'PATCH',token:child.csrf,body:{...row,status:'published'}})).status,403);
  const published=await f.call('parent',path,{method:'PATCH',token:parent.csrf,body:{...row,status:'published'}});
  assert.equal(published.status,200);assert.equal((await f.call('other',path)).body.data.status,'published');
  assert.equal((await f.call('parent',path,{method:'PATCH',token:parent.csrf,body:{...row,status:'published'}})).status,409);
});
test('only system admin configures private service and messaging links',async t=>{
  const f=await fixture(t),parent=await f.context('parent'),admin=await f.context('admin');
  const settings={services:{photos:'http://192.168.0.30:8212',vaultwarden:'https://vault.example.invalid'},whatsappGroupName:'Our family',whatsappInviteUrl:'https://chat.whatsapp.com/FixtureInvite'};
  assert.equal((await f.call('parent','/settings',{method:'PUT',token:parent.csrf,body:settings})).status,403);
  assert.equal((await f.call('admin','/settings',{method:'PUT',token:admin.csrf,body:settings})).status,200);
  assert.equal((await f.context('child')).settings.services.photos,'http://192.168.0.30:8212/');
  for(const value of ['javascript:alert(1)','http://public.example','https://user:password@service.example/'])assert.throws(()=>validateSettings({services:{photos:value}}));
  assert.throws(()=>validateSettings({...settings,whatsappInviteUrl:'https://chat.whatsapp.com.evil.example/invite'}));
});

test('everyone editing permits shared edits and own drafts, without publishing, archiving or seeing other drafts',async t=>{
  const f=await fixture(t,'everyone'),child=await f.context('child'),parent=await f.context('parent'),other=await f.context('other');
  assert.equal(child.canEdit,true);assert.equal(child.canPublish,false);
  const row=(await f.call('child','/articles',{method:'POST',token:child.csrf,body:{title:'My guide',body:'Original'}})).body.data,path='/articles/'+row.id;
  const edited=await f.call('child',path,{method:'PATCH',token:child.csrf,body:{...row,body:'My corrected draft',status:'published'}});
  assert.equal(edited.status,200);assert.equal(edited.body.data.status,'pending');
  assert.equal((await f.call('other',path,{method:'PATCH',token:other.csrf,body:{...edited.body.data}})).status,404);
  const published=(await f.call('parent',path,{method:'PATCH',token:parent.csrf,body:{...edited.body.data,status:'published'}})).body.data;
  const shared=await f.call('other',path,{method:'PATCH',token:other.csrf,body:{...published,body:'A useful family improvement',status:'archived'}});
  assert.equal(shared.status,200);assert.equal(shared.body.data.status,'published');assert.equal(shared.body.data.author_id,3);
  assert.equal((await f.call('child',path,{method:'PATCH',token:child.csrf,body:{...published}})).status,409);
  f.setAccess('read');assert.equal((await f.call('other',path,{method:'PATCH',token:other.csrf,body:{...shared.body.data}})).status,403);
  assert.throws(()=>validateSettings({knowledgebaseEditing:'anyone'}));
});
