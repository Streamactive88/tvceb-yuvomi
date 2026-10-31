# Family single sign-on

The user confirmed existing TVCEB -> Synology family sign-in works. This source
candidate does not change that deployed connection. The referenced photo-installation
chat retired Immich; its custom adapter is removed here. Family Photo Share and
PhotoPrism are the current photo applications.

The central Keycloak broker and service adapters are prepared under
[extensions/tvceb-sso](extensions/tvceb-sso/README.md). They require private NAS subject
verification, existing service account bindings, trusted HTTPS routing and individual
callback tests. Templates are not evidence of live SSO.

For direct Synology SSO, retain both the exact human username allowlist and complete
family group name. The group may contain service/admin accounts, so group membership
alone is insufficient. Spaces belong to one group name; commas separate names.
Provider-email linking stays disabled because NAS emails can be shared. Family users
receive no system-administrator privileges.

Vaultwarden still requires a vault master password. WhatsApp uses each person's linked
phone. Home Assistant needs its community OIDC adapter and a native recovery sign-in.
