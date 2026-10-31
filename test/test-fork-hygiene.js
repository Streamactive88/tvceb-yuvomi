import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('source checkout has LF-only UTF-8 text, including the Node version file',()=>{
  let checked=0;
  const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules','data','modules','backups','coverage','test-results'].includes(e.name))continue;
    const p=path.join(dir,e.name);
    if(e.isDirectory())walk(p);
    else if(e.isFile()){
      const b=fs.readFileSync(p);if(b.includes(0)||!Buffer.from(b.toString('utf8')).equals(b))continue;
      assert.ok(!b.includes(Buffer.from('\r\n')),path.relative(root,p)+' contains CRLF');checked++;
    }
  }};
  walk(root);assert.ok(checked>1000);assert.match(fs.readFileSync(path.join(root,'.nvmrc'),'utf8'),/^22\n$/);
});
test('upstream publication and domain ownership files are absent',()=>{
  for(const p of ['.github/FUNDING.yml','docs/CNAME','.github/workflows/docker-publish.yml','.github/workflows/umbrel-publish.yml','.github/workflows/claude.yml','.github/workflows/claude-code-review.yml'])assert.ok(!fs.existsSync(path.join(root,p)),p);
  const compose=fs.readFileSync(path.join(root,'compose.synology.yaml'),'utf8');assert.match(compose,/restart: unless-stopped/);
});
