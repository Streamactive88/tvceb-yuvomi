# Family single sign-on

Status: Synology SSO Server 3.0.7 is installed on the NAS. Family sign-in,
application registrations and the new HTTPS route are pending access approval.
Existing TVCEB password sign-in remains available.

Use the existing DSM family group rather than making duplicate passwords in
another identity container. The group includes administrative/service accounts;
the SSO client needs an explicit allowlist of the approved human accounts.
Keep real usernames, client secrets and encryption keys in the private NAS
configuration, outside Git.

Prepared TVCEB settings:

```
OIDC_ISSUER=https://login.int.s8.net.au/webman/sso
OIDC_REDIRECT_URI=https://home.int.s8.net.au/api/v1/auth/oidc/callback
OIDC_SCOPES=openid email groups
OIDC_ALLOWED_GROUPS=TVceb FamilyGroup
# Set OIDC_ALLOWED_USERNAMES to the approved exact NAS usernames.
# Set OIDC_CLIENT_ID and OIDC_CLIENT_SECRET from the registered DSM OIDC app.
AUTH_ALLOW_PASSWORD_LOGIN=true
```

The server checks the verified provider's group and username before linking,
creating or signing in an account. When configured, missing claims deny access.
New SSO family accounts are ordinary members; membership grants no system-admin
rights. Family roles and individual module permissions remain separate settings.

The HTTPS identity route must accept LAN clients only. Its certificate must be
trusted on the family phones. Those phones and the application containers must
resolve the internal domain through the LAN DNS server. Never use HTTP or turn
off TLS validation for the sign-in flow.

Before enabling Immich SSO, verify its client-side registration rules and
Synology's application privileges restrict access to the same approved people.
Keep its existing library ownership and private album sharing. Vaultwarden
and Home Assistant retain their current authentication until their supported
SSO integration has been configured and verified individually.

Validation of the prepared TVCEB changes: two family-policy checks, six token
authentication checks and twelve callback/redirect checks pass in an isolated
container with the application's dependencies. A real family sign-in remains
required before considering the SSO installation complete.
