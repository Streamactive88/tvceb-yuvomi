# Synology family access policy for Immich

This patch targets the pinned Immich 3.3.5 image. It checks verified NAS groups
and usernames and maps each approved username to an existing ordinary account.
Configure `TVCEB_SSO_ALLOWED_GROUPS`, `TVCEB_SSO_ALLOWED_USERNAMES` and the JSON
object `TVCEB_SSO_EMAIL_MAP` in a private env file; never commit real values.
Disable Immich OAuth auto-registration and retain its existing password login.

Run `node --test policy.test.mjs` to check the policy. On a normal Docker build
host, build the supplied Dockerfile. The patch checks every source anchor and
stops if an Immich upgrade changes the expected implementation.

Some Synology kernels cannot execute Docker build RUN stages. For those hosts,
mount this directory at `/out` in an ephemeral container of the exact pinned
base image and run:

```sh
node /out/patch.mjs
node --check /usr/src/app/server/dist/repositories/oauth.repository.js
cp /usr/src/app/server/dist/repositories/oauth.repository.js /out/patched-oauth.repository.js
```

Then build with `docker build -f Dockerfile.synology -t tvceb-immich:3.3.5-family-sso1 .`.
The generated repository file stays outside Git. Apply the image only to
`immich-server`; preserve all other services, persistent mounts and settings.
The HTTPS mobile callback must be registered with Synology and configured as
Immich's mobile redirect override.
