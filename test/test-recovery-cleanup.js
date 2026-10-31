import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createPasswordResetService } from '../server/services/password-reset.js';

test('consumed and expired recovery files are removed without deleting unrelated files', t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tvceb-recovery-'));
  const file=path.join(dir,'admin-recovery.json');
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec('CREATE TABLE password_resets (user_id INTEGER, token_hash TEXT, expires_at INTEGER)');
  let clock=Date.now();const service=createPasswordResetService({db,now:()=>clock,recoveryFile:file});
  const token=service.createToken(7);
  fs.writeFileSync(file,JSON.stringify({code:token.token,expiresAt:new Date(token.expiresAt).toISOString()}));
  service.consumeToken('f'.repeat(64));assert.ok(fs.existsSync(file));
  service.consumeToken(token.token);assert.ok(!fs.existsSync(file));assert.equal(service.verifyToken(token.token),null);
  const next=service.createToken(7);
  fs.writeFileSync(file,JSON.stringify({code:next.token,expiresAt:new Date(next.expiresAt).toISOString()}));
  clock=next.expiresAt+1;service.cleanupExpired();assert.ok(!fs.existsSync(file));
  const revoked=service.createToken(7);
  fs.writeFileSync(file,JSON.stringify({code:revoked.token,expiresAt:new Date(revoked.expiresAt).toISOString()}));
  service.revokeForUser(7);assert.ok(!fs.existsSync(file));assert.equal(service.verifyToken(revoked.token),null);
  fs.writeFileSync(file,'unrelated backup');service.cleanupExpired();assert.equal(fs.readFileSync(file,'utf8'),'unrelated backup');
});
