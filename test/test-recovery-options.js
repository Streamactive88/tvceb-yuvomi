import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { recoveryOptions, promptSecret } from '../scripts/recovery-options.mjs';

test('recovery options preserve the existing name unless a rename is explicit', () => {
  const account = {username:'existing-owner'};
  assert.equal(recoveryOptions(['--user-id','7'])['--username'] ?? account.username, 'existing-owner');
  assert.equal(recoveryOptions(['--user-id','7','--username','replacement'])['--username'], 'replacement');
  assert.equal(recoveryOptions(['--temporary-password'])['--temporary-password'], true);
  for (const args of [['--temporary-password','NeverEcho!'],['--username'],['--output','/tmp/token'],['--user-id','1','--user-id','2']]) assert.throws(()=>recoveryOptions(args));
});

test('temporary password is prompted without echo and terminal state is restored', async () => {
  const input = new EventEmitter(); input.isTTY=true; input.isRaw=false;
  input.setRawMode=v=>{input.isRaw=v;};input.resume=()=>{};input.pause=()=>{};
  // readline only installs its byte decoder on a readable stream; direct
  // keypress events exercise the same handler without a real terminal.
  input.readable=true;input.on('newListener',()=>{});
  let output='';
  const result=promptSecret({input,output:{write:s=>{output+=s;}}});
  input.emit('keypress','A@#&!',{});input.emit('keypress','',{name:'return'});
  assert.equal(await result,'A@#&!');assert.equal(input.isRaw,false);
  assert.ok(!output.includes('A@#&!'));assert.equal(input.listenerCount('keypress'),0);
  assert.throws(()=>promptSecret({input:{isTTY:false}}),/interactive/);
});
