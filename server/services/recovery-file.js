import fs from 'node:fs';
import crypto from 'node:crypto';

// Never delete arbitrary backups: only the configured JSON recovery file, after
// checking its token against the consumed hash or its recorded expiration.
export function removeRecoveryFile(file, { tokenHash, expiredAt } = {}) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const details = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof details.code !== 'string' || !/^[a-f0-9]{64}$/.test(details.code)) return false;
    const hash = crypto.createHash('sha256').update(details.code).digest('hex');
    const expires = Date.parse(details.expiresAt);
    if (!(tokenHash && hash === tokenHash) && !(Number.isFinite(expiredAt) && Number.isFinite(expires) && expires <= expiredAt)) return false;
    const current = fs.lstatSync(file);
    if (current.ino !== stat.ino || current.dev !== stat.dev || current.mtimeMs !== stat.mtimeMs) return false;
    fs.unlinkSync(file);
    return true;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code) || error instanceof SyntaxError) return false;
    throw error;
  }
}
