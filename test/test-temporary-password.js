import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { markTemporaryPassword, requiresPasswordChange } from '../server/services/temporary-password.js';

test('a temporary credential requires replacement only until its hash changes', () => {
  const database = new DatabaseSync(':memory:');
  database.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, password_hash TEXT NOT NULL)');
  database.prepare('INSERT INTO users VALUES (?, ?)').run(1, 'temporary-hash');
  database.prepare('INSERT INTO users VALUES (?, ?)').run(2, 'other-hash');
  assert.equal(requiresPasswordChange(database, 1), false);
  markTemporaryPassword(database, 1, 'temporary-hash');
  assert.equal(requiresPasswordChange(database, 1), true);
  assert.equal(requiresPasswordChange(database, 2), false);
  database.prepare('UPDATE users SET password_hash = ? WHERE id = 1').run('replacement-hash');
  assert.equal(requiresPasswordChange(database, 1), false);
  markTemporaryPassword(database, 1, 'replacement-hash');
  assert.equal(requiresPasswordChange(database, 1), true);
  database.close();
});
