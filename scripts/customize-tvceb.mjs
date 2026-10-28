import fs from 'node:fs';
import path from 'node:path';

// Run once on a fresh upstream checkout; safe to repeat.
const files = [
  'public/index.html', 'public/manifest.json', 'public/offline.html',
  'public/router.js', 'public/sw.js', 'public/pages/login.js',
  'public/pages/setup.js', 'public/pages/dashboard.js', 'public/utils/auth-ui.js',
  'public/settings/pages/admin-system.js', 'public/settings/pages/admin-email.js',
  'public/components/yuvomi-install-prompt.js',
  'server/index.js', 'server/routes/preferences.js', 'server/auth.js',
  'server/routes/notifications.js', 'server/openapi.js',
  'server/services/email.js', 'server/services/notifications.js',
  ...fs.readdirSync('public/locales').filter(f => f.endsWith('.json'))
    .map(f => path.posix.join('public/locales', f)),
];
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  // Keep the upstream Google Drive folder name: it is a storage identifier.
  const after = before.replace(/\bYuvomi\b(?!\/Documents)/g, 'tvceb').replace(/\r\n/g, '\n');
  if (after !== before) fs.writeFileSync(file, after);
}
console.log('Applied tvceb display branding. Storage and protocol identifiers retained.');
