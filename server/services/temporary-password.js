// A server-shell recovery credential can only open the password reset form.
// Tie the requirement to the hash, so replacing the password ends it automatically.
export function requiresPasswordChange(database, userId) {
  if (!database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'temporary_passwords'").get()) return false;
  return !!database.prepare(`SELECT 1 FROM temporary_passwords t JOIN users u ON u.id = t.user_id
    WHERE u.id = ? AND u.password_hash = t.password_hash`).get(userId);
}

export function markTemporaryPassword(database, userId, passwordHash) {
  database.exec('CREATE TABLE IF NOT EXISTS temporary_passwords (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, password_hash TEXT NOT NULL)');
  database.prepare('INSERT OR REPLACE INTO temporary_passwords (user_id, password_hash) VALUES (?, ?)').run(userId, passwordHash);
}
