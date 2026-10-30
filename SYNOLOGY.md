# tvceb on Synology

## Installed deployment — 30 October 2026

- URL: **https://home.int.s8.net.au**.
- NAS: `192.168.8.20`, Docker container `tvceb`, image `tvceb:2.82.0-recovery2`.
- Built from published source revision `6313429956d4df0ce4a8b30bceddd5b3a17370a3`.
- Dockhand project directory on the NAS:
  `/volume1/docker/dockhand/stacks/s8netau/tvceb-yuvomi`.
- Runtime Compose: `docker-compose.yml` in that directory; the image is imported
  locally, so this deployed file has no source-build section.
- Fresh encrypted database and documents use the four `/volume1/docker/yuvomi`
  directories described below. There was no existing Yuvomi container or data folder.
- Fresh session and database encryption keys are in the stack `.env` (mode `600`).
  Back up that file securely with the database; the key is required for restoration.
- `SESSION_SECURE=true`, `TRUST_PROXY=192.168.8.254`,
  `BASE_URL=https://home.int.s8.net.au`; timezone remains `Europe/Bucharest`.
- Technitium internal A record: `home.int.s8.net.au` → `192.168.8.254`, TTL 300.
- NPMplus host ID 2 forwards HTTPS to `http://192.168.8.20:3245` with HTTPS
  enforcement and existing wildcard certificate ID 6.
- This PC has a backed-up hosts entry for the internal proxy because its configured
  resolver is the router (`192.168.8.1`). Other clients need internal DNS
  `192.168.8.253` or an equivalent local hostname mapping.
- Verified: image build, isolated startup test, NAS container healthy, encrypted
  database, internal DNS read-back, trusted HTTPS 200, live tvceb setup page.
- No public DNS records or Cloudflare Tunnel routes were changed.

The administrator account has been created. Its username is `admin`.

## Administrator recovery

The deployed image `tvceb:2.82.0-recovery2` adds a visible **Forgot password?**
option on the login page. Configured email installations keep the existing email
reset flow. Without SMTP, the page accepts a one-time recovery code issued from
the server shell. No unauthenticated account-reset endpoint is added.

From the Dockhand **tvceb** container shell:

```sh
node scripts/recover-admin.mjs --list
node scripts/recover-admin.mjs --user-id 1 --username admin
```

The command backs up the encrypted database, preserves the account ID and data,
invalidates its old password and sessions, and saves a private one-hour reset link
and code in `/backups/admin-recovery.json` (mode 600). Open that link and choose a
new password. Existing two-factor authentication settings are retained.

The username must be unused by other accounts. With more than one administrator,
select the intended account explicitly using `--user-id`.

Personal display-branding fork of Yuvomi 2.82.0, based on upstream commit
`aec5cf0cbc581b35b6377a5f56438a4ec5bbd01c`.
The MIT licence and upstream attribution remain in LICENSE and README.md.

## Install in DSM Container Manager

1. Copy this source folder to `/volume1/docker/tvceb/source` on the NAS.
2. Create `/volume1/docker/yuvomi/data`, `backups`, `modules` and `documents`.
   These are the persistent paths from the supplied stack; the renamed app
   deliberately keeps them and `/data/yuvomi.db`.
3. Copy `.env.synology.example` to `.env` in the source folder and set a random
   session secret. A local `.env` has been prepared using the supplied value;
   it is excluded from Git and source archives. Transfer it separately if using it.
   If the database is already encrypted, also provide its existing encryption key.
4. If an existing Yuvomi container uses these folders, stop it first. Never run two
   containers against the same database. Preserve a stopped copy of all four
   folders and the old configuration before the first start.
5. In **Container Manager > Project > Create**, choose project name `tvceb`,
   select the source folder as the path and use `compose.synology.yaml` as the
   Compose configuration (upload it or paste its contents). Build and start it.
   This builds the customised source; pulling the upstream image would show
   upstream branding. The NAS needs internet access during the first build.
6. Open `http://NAS-IP:3245`. On a fresh database create the first administrator.
   On an existing database, sign in normally. If a saved custom application name
   still shows Yuvomi, set **Settings > application name** to `tvceb`; the fork
   changes the default without overwriting an existing household preference.

Equivalent SSH commands, run from the source directory:

```sh
sudo docker compose -f compose.synology.yaml up -d --build
sudo docker compose -f compose.synology.yaml ps
sudo docker compose -f compose.synology.yaml logs --tail=80 tvceb
```

Older Docker installations may use `docker-compose` in place of `docker compose`.
This deployment uses the supplied port 3245, Europe/Bucharest timezone,
local document storage and `on-failure:5` restart policy. With that restart
policy, a manually stopped container needs to be started again manually.

## HTTPS reverse proxy

For a DSM HTTPS reverse proxy, point the destination to `http://127.0.0.1:3245`,
set `SESSION_SECURE=true` and `TRUST_PROXY=1` in `.env`, and recreate the service.
Only use that proxy setting where clients reach the service through the trusted
proxy. Use the HTTPS address for sign-in and installation on phones.
Direct HTTP uses `false` and `0`, matching the supplied stack.

## Updates and recovery

Keep this source and the customised image. An upstream image pull does not contain
tvceb changes. Back up all four persistent folders and the configuration; the app's
database backups alone do not include documents saved under `/documents`.
Restore the matching data snapshot when reverting to an older application version.
Retain any encryption key with the backup.

The source archive contains no `.env`, live data or credentials. After editing
the source, rebuild with the same Compose command. The original Yuvomi logo,
storage identifiers, API paths and database migrations are retained for compatibility.

To set a temporary administrator password that must be changed before access, run the recovery helper with --temporary-password and your chosen temporary value. This also backs up the database and revokes existing sessions. The normal minimum of eight characters applies to the replacement password.
