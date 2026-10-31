# Family single sign-on

Status: Synology SSO Server 3.0.7 and Family sign-in are enabled for TVCEB
and Immich. The approved family group and exact human-account allowlist are
enforced by both applications. The user confirmed a successful TVCEB family
sign-in. A real Immich family sign-in still needs confirmation. Existing password
sign-in remains available.

Use the existing DSM family group rather than making duplicate passwords in
another identity container. The group includes administrative/service accounts;
the SSO client needs an explicit allowlist of the approved human accounts.
Keep real usernames, client secrets and encryption keys in the private NAS
configuration, outside Git.

TVCEB settings (client credentials belong in the private NAS env file):

```
OIDC_ISSUER=https://login.example.invalid/webman/sso
OIDC_REDIRECT_URI=https://home.example.invalid/api/v1/auth/oidc/callback
OIDC_SCOPES=openid email groups
OIDC_ALLOWED_GROUPS=Family Group
OIDC_ALLOWED_USERNAMES=parent1,parent2,child1
OIDC_USE_PROVIDER_EMAIL=false
OIDC_ALLOW_SIGNUP=true
# Set OIDC_ALLOWED_USERNAMES to the approved exact NAS usernames.
# Set OIDC_CLIENT_ID and OIDC_CLIENT_SECRET from the registered DSM OIDC app.
AUTH_ALLOW_PASSWORD_LOGIN=true
```

The server checks the verified provider's group and username before linking,
creating or signing in an account. When configured, missing claims deny access.
New SSO family accounts are ordinary members; membership grants no system-admin
rights. Family roles and individual module permissions remain separate settings.
Provider email matching is disabled because several NAS accounts can share the
same email address. Existing local administrator accounts must not be linked by email.

Both allowlists are mandatory for Synology family SSO. The group setting is a
comma-separated list: spaces are preserved inside a name, so `Family Group` is
one name, while `Family,Group` is two. Confirm the provider's group claim matches
the complete configured name and deny accounts absent from the username list.

The HTTPS identity route must accept LAN clients only. Its certificate must be
trusted on the family phones. Those phones and the application containers must
resolve the internal domain through the LAN DNS server. Never use HTTP or turn
off TLS validation for the sign-in flow.

The login proxy uses HTTPS upstream port 8412. Synology's HTTP port 8411
returns a JavaScript HTTPS redirect and caused a loop behind TLS termination.
Keep the LAN-only proxy restrictions and trusted public-facing certificate.
Internal DNS at INTERNAL_DNS_IP resolves the family hosts to PROXY_LAN_IP;
Eero Custom DNS now uses the internal resolver. Queries through the Eero gateway
return the LAN proxy for sign-in and photos, without a public IPv6 answer.

Immich uses the pinned image and policy under
`extensions/tvceb-family/immich-sso`. Auto-registration is disabled. The verified
NAS username maps through a private, explicit email map to an existing ordinary
photo account. Shared provider email is never used for linking. Preserve the
guard when upgrading Immich; its patch refuses an unexpected implementation.
Keep existing library ownership and private album sharing. Vaultwarden
and Home Assistant retain their current authentication until their supported
SSO integration has been configured and verified individually.

Deployed images: `tvceb:2.82.0-original-menu1` (based on the family SSO image) and
`tvceb-immich:3.3.5-family-sso1`. Original Compose and Immich authentication
configuration snapshots are stored privately on the NAS for rollback.

Validation: three TVCEB family-policy checks, three Immich policy checks, six token
authentication checks and twelve callback/redirect checks pass in an isolated
container with the application's dependencies. A real family sign-in remains
required for Immich before considering both integrations verified. TVCEB's complete
sign-in was confirmed by the user; the Synology username form also renders correctly.
