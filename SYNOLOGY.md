# TVCEB on Synology

This fork is based on Yuvomi 2.82.0. Keep the MIT licence and upstream attribution.
Deployment addresses, proxy host/certificate IDs and account details belong in
private deployment notes and environment files, outside Git and source archives.

## Install

1. Create the persistent data, backups, modules and documents directories in
   `compose.synology.yaml`. Preserve existing folders and encryption keys.
2. Copy `.env.synology.example` to `.env` and choose a random session secret.
3. Build and start with `docker compose -f compose.synology.yaml up -d --build`.
4. Open the mapped port on your NAS and complete setup or sign in.

The service uses `restart: unless-stopped`: Docker starts it after a daemon/NAS
restart unless an operator explicitly stopped it. Keep backups of the database,
documents, modules and private configuration together.

## Reverse proxy

Use trusted HTTPS. Configure `BASE_URL`, `SESSION_SECURE=true` and `TRUST_PROXY`
for the actual proxy and any Docker bridge peer that forwards its connections.
Do not trust arbitrary network clients. Configure internal DNS on phones and
other LAN clients; do not publish the sign-in host to the internet.

## Administrator recovery

From an interactive server/container shell:

```sh
node scripts/recover-admin.mjs --list
node scripts/recover-admin.mjs --user-id 1
```

The helper preserves the existing username, account ID and data. To deliberately
rename the account, also supply `--username NEW_NAME`. It backs up the encrypted
database, invalidates the old password and sessions, and writes a private one-hour
reset link. Open that link privately. Existing two-factor settings remain.

`ADMIN_RECOVERY_FILE` selects the private JSON output file; its default is
`/backups/admin-recovery.json`. Configure it in the server/container environment
so the helper and service use the same path. The file is removed when that token
is consumed or when expired-token cleanup runs. Backups retain their own policy.

For a temporary password requiring a change after login, run:

```sh
node scripts/recover-admin.mjs --user-id 1 --temporary-password
```

The password is requested through a hidden terminal prompt. Never put it in
arguments or shell history. Non-interactive password entry is refused.

## Extensions and upgrades

Install `extensions/` modules separately and configure private service URLs in
the deployed copies. See `FAMILY-SSO.md` and `UPGRADING.md`. New builds contain a
built-in auth image fallback; the optional private family image is not distributed.
