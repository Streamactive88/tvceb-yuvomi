# Prepared family SSO broker and adapters

Deployment candidate, not an installed broker. Keycloak 26.8.1 implements OIDC;
existing TVCEB NAS SSO stays in place until migration passes. Immich is retired.
Photos means Family Photo Share, with PhotoPrism as the separate library.

## Private preparation

1. Choose a new LAN-only HTTPS broker origin. Keep the working NAS login hostname.
   Configure trusted DNS/certificate and a proxy that overwrites forwarded headers.
   Compose exposes a loopback port only; a container proxy needs a private Docker
   network instead. Restrict `/admin/` to the operator network.
2. Register a dedicated NAS OIDC client with callback
   `BROKER_ORIGIN/realms/tvceb-family/broker/synology/endpoint`. Fill a private copy
   of `config.example.json` using the NAS discovery document. Example endpoint
   paths are placeholders, not verified DSM endpoints.
3. Verify the approved five humans' exact NAS subjects and existing family group
   membership privately. Assign each a unique verified email matching their own
   existing service accounts. Do not use shared NAS emails or add service/admin users.
4. Run `node prepare.mjs secrets/config.json generated` once. It rejects incomplete
   mappings, duplicate subjects/emails, HTTP and an existing output directory.
   Generated files contain secrets and stable broker user UUIDs. Keep them private,
   backed up, with operator-only NAS ACLs (Windows chmod does not set ACLs).
5. Set `FAMILY_SSO_ORIGIN` privately and run `docker compose up -d`. Budget about
   1.5 GiB for Keycloak plus PostgreSQL. Create a permanent operator with MFA and
   remove the temporary bootstrap administrator after initial setup.

Only prelinked NAS subjects can sign in. Unlinked identities hit a required
deny-access first-login flow. Registration, email recovery/login, password and
implicit grants, service accounts and the family's account-linking console are
disabled. Clients have exact callbacks and PKCE S256. Imported family users have
no credentials or realm-admin roles; the master-realm operator is separate.

This is an explicit allowlist, not dynamic NAS-group synchronization. To revoke
access, disable the broker user, revoke broker AND service sessions and remove NAS
membership. Removing a NAS group alone does not revoke issued tokens. Initial
import only creates a realm; editing JSON does not update an existing realm.
Preserve user UUIDs and back up PostgreSQL plus private mappings.

## Service adapters

`generated/client-settings.json` contains private client secrets and broker UUIDs.
Never publish it or put it into browser assets.

- **TVCEB:** broker realm issuer, client `tvceb`, scopes `openid profile email groups`,
  existing callback, exact username allowlist, `OIDC_ALLOWED_GROUPS=TVceb Family`.
  Keep password login. Existing NAS-issuer links need a backed-up migration to the
  generated broker UUIDs. Do not use automatic email linking or duplicate people.
- **Vaultwarden:** merge `adapters/vaultwarden.env.example` privately. Existing users
  link SSO while signed into their vault. Registration and email matching stay off.
  Test mobile and desktop; the vault master password still decrypts contents.
- **PhotoPrism:** merge its adapter env into the existing Plus installation, with
  unchanged mounts. Bind broker subjects to existing ordinary users through account
  administration. Registration remains off; preserve album/privacy permissions.
- **Family Photo Share:** run
  `node adapters/family-photo-share/prepare-source.mjs EXISTING_SOURCE NEW_CANDIDATE`.
  This checks source anchors and makes a separate candidate with Devise/OmniAuth,
  POST+CSRF login, PKCE and explicit subject-to-existing-user-ID mapping. Resolve
  and lock the two gems with Bundler in that application's source, build a candidate
  image and run its tests. Fill its config privately, set `FAMILY_OIDC_ENABLED=true`
  and mount `FAMILY_OIDC_CONFIG_FILE`. No new users or runtime email linking.
  Test locked users, unknown subjects, state/nonce rejection and parent/child album
  isolation against a separate test database before deployment. Native login stays.
- **Home Assistant:** install `christiaangoossens/hass-oidc-auth` through HACS, then
  merge `adapters/homeassistant.yaml`. Built-in HA has no OIDC client. The candidate
  intentionally denies unlinked identities. Review a one-time binding to existing
  ordinary HA accounts; never enable unrestricted username linking or map a family
  identity to an owner/admin. Retain native recovery login and TLS validation.
  The adapter version must support `require_existing_user` before applying.
- **CCTV/knowledgebase** reuse the TVCEB session and their own module rights.
  **WhatsApp** requires each person's own account and private phone linking.

Verify every real family account's callback and ordinary access in each application
before changing launchers or disabling existing sign-ins. Prepared templates do not
prove live SSO, and SSO does not merge service permissions.

## Primary references

- [Keycloak containers](https://www.keycloak.org/server/containers),
  [release](https://www.keycloak.org/downloads),
  [broker flows](https://www.keycloak.org/docs/26.4.7/server_admin/index.html).
- [Vaultwarden OIDC](https://github.com/dani-garcia/vaultwarden/wiki/Enabling-SSO-support-using-OpenId-Connect).
- [PhotoPrism OIDC](https://docs.photoprism.app/getting-started/advanced/openid-connect/).
- [OmniAuth OIDC](https://github.com/omniauth/omniauth_openid_connect).
- [HA integration](https://github.com/christiaangoossens/hass-oidc-auth) and
  [configuration](https://github.com/christiaangoossens/hass-oidc-auth/blob/main/docs/configuration.md).
