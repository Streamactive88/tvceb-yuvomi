FROM ghcr.io/immich-app/immich-server@sha256:485d546a2e31d6a8b4db8423fcba5c109de8c218d93410af115fd1ccfc4352a6
COPY policy.mjs patch.mjs /opt/tvceb-family-sso/
RUN node /opt/tvceb-family-sso/patch.mjs && node --check /usr/src/app/server/dist/repositories/oauth.repository.js
