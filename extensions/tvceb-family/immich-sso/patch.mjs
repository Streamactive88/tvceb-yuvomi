import { createHash } from 'node:crypto';
import fs from 'node:fs';
const file = '/usr/src/app/server/dist/repositories/oauth.repository.js';
let source = fs.readFileSync(file, 'utf8');
const anchors = ["if (tokenClaims && 'email' in tokenClaims) {", 'if (!profile.sub) {', 'fetchUserInfo(client, tokens.access_token, skipSubjectCheck)'];
for (const anchor of anchors) if (source.split(anchor).length !== 2) throw Error('Unexpected Immich OAuth implementation; refusing to patch.');
source = "import { normalizeFamilyProfile } from '/opt/tvceb-family-sso/policy.mjs';\n" + source;
source = source.replace(anchors[0], "if (tokenClaims && 'email' in tokenClaims && Array.isArray(tokenClaims.groups) && typeof tokenClaims.username === 'string') {");
source = source.replace(anchors[1], 'profile = normalizeFamilyProfile(profile);\n            if (!profile.sub) {');
source = source.replace(anchors[2], 'fetchUserInfo(client, tokens.access_token, tokenClaims?.sub ?? skipSubjectCheck)');
fs.writeFileSync(file, source);

fs.writeFileSync(file + '.sha256', createHash('sha256').update(source).digest('hex') + '  patched-oauth.repository.js\n');
