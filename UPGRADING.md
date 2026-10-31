# Maintaining the TVCEB fork

Base: Yuvomi 2.82.0, upstream commit
`aec5cf0cbc581b35b6377a5f56438a4ec5bbd01c`.
Keep the fork changes on a dedicated branch. Do not edit upstream release tags
or rewrite the published main branch. The hardening work uses
`codex/fork-hardening`.

For each update, fetch the exact upstream release tag into an upstream remote,
create a new `codex/upgrade-VERSION` branch from the maintained fork branch, and
rebase that new branch onto the verified tag. Resolve core authentication and
login-page changes deliberately. Rebuild the containers and run the auth,
recovery, SSO, extension and upstream compatibility tests before merging.

Keep extensions isolated under `extensions/`. Core changes are limited to
branding/auth fallback, temporary-password recovery and OIDC family policy.
Do not restore removed publishing workflows, funding settings or custom domains
when resolving upgrade conflicts. Keep deployment configuration outside Git.

The Immich adapter pins a digest and checks patch anchors. For every upgrade,
generate and record the patched file's SHA-256 and review the OAuth changes.
Never silently reuse a compiled patch against another Immich image.

`.gitattributes` pins LF for text on Windows as well as Linux. Verify both the
checkout and exported archive; Git archive can apply working-tree conversions.
