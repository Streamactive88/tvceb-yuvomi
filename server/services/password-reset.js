/**
 * Modul: Password-Reset-Service
 * Zweck: Sichere Reset-Tokens erzeugen (nur Hash gespeichert), prüfen, verbrauchen
 *        und abgelaufene Tokens aufräumen.
 * Abhängigkeiten: node:crypto, server/db.js
 */
import crypto from 'node:crypto';
import * as dbModule from '../db.js';
import { createLogger } from '../logger.js';
import { removeRecoveryFile } from './recovery-file.js';

const log = createLogger('PasswordReset');
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function createPasswordResetService({ db, now = () => Date.now(), recoveryFile = process.env.ADMIN_RECOVERY_FILE || '/backups/admin-recovery.json' } = {}) {
  const getDb = () => (db || dbModule.get());

  function hash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  function createToken(userId) {
    // One active token per user: drop any prior ones first.
    revokeForUser(userId);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = now() + TOKEN_TTL_MS;
    getDb().prepare(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(userId, hash(token), expiresAt);
    return { token, expiresAt };
  }

  function verifyToken(token) {
    if (!token) return null;
    const row = getDb().prepare(
      'SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?'
    ).get(hash(token));
    if (!row) return null;
    if (row.expires_at <= now()) return null;
    return row.user_id;
  }

  function consumeToken(token) {
    getDb().prepare('DELETE FROM password_resets WHERE token_hash = ?').run(hash(token));
    try { removeRecoveryFile(recoveryFile, { tokenHash: hash(token) }); }
    catch { log.warn('Could not remove the consumed administrator recovery file; remove it from private storage.'); }
  }

  function cleanupExpired() {
    const info = getDb().prepare('DELETE FROM password_resets WHERE expires_at <= ?').run(now());
    try { removeRecoveryFile(recoveryFile, { expiredAt: now() }); }
    catch { log.warn('Could not remove the expired administrator recovery file; remove it from private storage.'); }
    if (info.changes) log.info(`Cleaned up ${info.changes} expired reset token(s)`);
    return info.changes;
  }

  function revokeForUser(userId) {
    const rows = getDb().prepare('SELECT token_hash FROM password_resets WHERE user_id = ?').all(userId);
    getDb().prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
    for (const row of rows) {
      try { removeRecoveryFile(recoveryFile, { tokenHash: row.token_hash }); }
      catch { log.warn('Could not remove the revoked administrator recovery file; remove it from private storage.'); }
    }
  }

  return { createToken, verifyToken, consumeToken, cleanupExpired, revokeForUser };
}

export const passwordResetService = createPasswordResetService();
