import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {startTestServer} from './server-ready.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tvceb-cli-recovery-'));
const recoveryFile=path.join(dir,'recovery.json');
const {baseUrl,dbPath}=await startTestServer({name:'recover-admin',env:{SESSION_SECRET:'fixture-recovery-secret-at-least-32-chars',ADMIN_RECOVERY_FILE:recoveryFile}});
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const {get}=await import('../server/db.js');

test('real recovery CLI preserves username, allows an explicit rename and cleans up a redeemed token',async()=>{
  const setup=await fetch(baseUrl+'/api/v1/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'original-owner',display_name:'Owner',password:'FixturePassword123!'})});
  assert.equal(setup.status,201);
  const account=get().prepare("SELECT id,password_hash FROM users WHERE username='original-owner'").get();
  const run=args=>spawnSync(process.execPath,['scripts/recover-admin.mjs','--user-id',String(account.id),...args],{encoding:'utf8',env:{...process.env,DB_PATH:dbPath,BACKUP_DIR:dir,ADMIN_RECOVERY_FILE:recoveryFile},timeout:30000});
  const denied=run(['--temporary-password']);assert.notEqual(denied.status,0);assert.equal(get().prepare('SELECT password_hash FROM users WHERE id=?').get(account.id).password_hash,account.password_hash);
  const recovery=run([]);assert.equal(recovery.status,0,recovery.stderr);
  assert.equal(get().prepare('SELECT username FROM users WHERE id=?').get(account.id).username,'original-owner');
  const details=JSON.parse(fs.readFileSync(recoveryFile,'utf8'));assert.ok(!recovery.stdout.includes(details.code));
  const reset=await fetch(baseUrl+'/api/v1/auth/reset-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:details.code,password:'ReplacementFixture!123'})});
  assert.equal(reset.status,200);assert.ok(!fs.existsSync(recoveryFile));
  const renamed=run(['--username','new-owner']);assert.equal(renamed.status,0,renamed.stderr);
  assert.equal(get().prepare('SELECT username FROM users WHERE id=?').get(account.id).username,'new-owner');
});
