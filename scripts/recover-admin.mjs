// Run only from the server/container shell. No recovery endpoint is exposed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as db from '../server/db.js';
import { hashPassword } from '../server/utils/password.js';
import { createPasswordResetService } from '../server/services/password-reset.js';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key)+1] : fallback;
db.init();
const database = db.get();
const admins = database.prepare("SELECT id, username FROM users WHERE role = 'admin' AND deactivated_at IS NULL").all();
if (args.includes('--list')) {
  console.log(JSON.stringify(admins));
  process.exit(0);
}
const selectedId = Number(option('--user-id', admins.length === 1 ? admins[0].id : NaN));
const account = admins.find(user => user.id === selectedId);
if (!account) throw Error('Select one active administrator with --user-id. Use --list first.');
const username = option('--username', 'admin');
if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(username)) throw Error('Invalid administrator username.');
const collision = database.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?').get(username, account.id);
if (collision) throw Error('That username belongs to another account. No changes made.');
const output = option('--output', '/backups/admin-recovery.json');
if (!path.isAbsolute(output)) throw Error('Use an absolute output path.');
fs.mkdirSync(path.dirname(output), { recursive: true });
const backup = path.join('/backups', 'before-admin-recovery-' + Date.now() + '.db');
await db.backupToFile(backup);
const passwordHash = await hashPassword(crypto.randomBytes(48).toString('hex'));
const service = createPasswordResetService({ db: database });
let recovery;
database.transaction(() => {
  database.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(username, passwordHash, account.id);
  for (const session of database.prepare('SELECT sid, sess FROM sessions').all()) {
    try {
      if (JSON.parse(session.sess).userId === account.id) database.prepare('DELETE FROM sessions WHERE sid = ?').run(session.sid);
    } catch {}
  }
  recovery = service.createToken(account.id);
})();
const origin = String(process.env.BASE_URL || '').replace(/\/$/, '');
const details = { username, code: recovery.token, expiresAt: new Date(recovery.expiresAt).toISOString(),
  url: origin + '/reset-password?token=' + recovery.token, backup };
fs.writeFileSync(output, JSON.stringify(details, null, 2) + '\n', { mode: 0o600 });
fs.chmodSync(output, 0o600);
console.log(JSON.stringify({ username, output, expiresAt: details.expiresAt, backup, previousPasswordInvalidated: true }));
