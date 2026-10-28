# tvceb on Synology

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
