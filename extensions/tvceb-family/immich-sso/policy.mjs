const list = value => (value ?? '').split(',').map(x => x.trim()).filter(Boolean);
export function normalizeFamilyProfile(profile, env = process.env) {
  const groups = list(env.TVCEB_SSO_ALLOWED_GROUPS);
  const users = list(env.TVCEB_SSO_ALLOWED_USERNAMES);
  const username = profile?.username ?? profile?.preferred_username;
  let emailMap;
  try { emailMap = JSON.parse(env.TVCEB_SSO_EMAIL_MAP ?? '{}'); } catch { throw Error('Family SSO policy is not configured.'); }
  if (!groups.length || !users.length || typeof username !== 'string' || !users.includes(username)
    || !Array.isArray(profile?.groups) || !profile.groups.some(g => typeof g === 'string' && groups.includes(g))
    || !Object.hasOwn(emailMap, username) || typeof emailMap[username] !== 'string' || !emailMap[username].includes('@')) {
    throw Error('Family SSO access denied.');
  }
  return {...profile, email: emailMap[username], name: profile.name || username};
}
