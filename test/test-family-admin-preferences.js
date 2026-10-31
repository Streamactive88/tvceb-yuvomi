import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer,cookieHeader} from './server-ready.js';
const {baseUrl}=await startTestServer({name:'family-admin-preferences',env:{SESSION_SECRET:'family-fixture-secret-at-least-32-characters'}});
async function request(path,method='GET',body,session){
  const response=await fetch(baseUrl+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}: {})},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json(),headers:response.headers};
}
async function login(username){
  const result=await request('/auth/login','POST',{username,password:'FixturePassword!123'});
  const cookie=cookieHeader(result.headers.get('set-cookie'));
  const me=await request('/auth/me','GET',null,{cookie});return{cookie,csrf:me.data.csrfToken};
}
test('only admin can choose the household-wide simple menu, and unauthorized mixed requests do not persist it',async()=>{
  assert.equal((await request('/auth/setup','POST',{username:'fixture-parent',display_name:'Parent',password:'FixturePassword!123'})).status,201);
  const parent=await login('fixture-parent');
  assert.equal((await request('/auth/users','POST',{username:'fixture-child',display_name:'Child',family_role:'child',password:'FixturePassword!123'},parent)).status,201);
  const child=await login('fixture-child');
  assert.equal((await request('/preferences','PUT',{family_simple_navigation:true},parent)).status,200);
  assert.equal((await request('/preferences','GET',null,child)).data.data.family_simple_navigation,true);
  assert.equal((await request('/preferences','PUT',{family_simple_navigation:false,hidden_modules:[]},child)).status,403);
  assert.equal((await request('/preferences','GET',null,parent)).data.data.family_simple_navigation,true);
  assert.equal((await request('/preferences','PUT',{family_simple_navigation:'false'},parent)).status,400);
});
