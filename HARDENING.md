# Fork hardening — 1 November 2026

The source and exported archive use LF text, including `.nvmrc`. The explicit
`eol=lf` rule prevents Windows checkout/archive conversion from reintroducing CRLF.
Line-ending normalization is separated from functional changes in Git history.

Administrator recovery preserves the username unless `--username` is explicit.
Temporary passwords use an interactive hidden prompt, never command arguments.
The public recovery page uses the existing translated administrator-contact
guidance, with no command, file path or English-only recovery form.
Consumed, revoked and expired recovery tokens remove their matching private JSON
file. Password changes revoke outstanding reset links. Database backups remain.

Synology family SSO requires exact group and username allowlists. Spaces inside
group names are preserved; only commas delimit groups. Tests prove a spaced
group is one exact claim and that missing allowlists deny family sign-in.

Public deployment notes and launcher examples contain placeholders. Live
addresses, proxy IDs, names and credentials stay outside the repository.
Inherited Docker/Umbrel publishing and Claude workflows, funding configuration
and the upstream custom-domain file are removed. CI remains enabled.
The optional private portrait has a built-in SVG fallback, confirmed in a clean
browser instance without the image. No private image is required to build.

The Synology template uses `unless-stopped`. RTSP camera-ID allowlists are
enforced, recorder previews use substreams, and decoding is capped at four
simultaneous channels. The pinned Immich patch emits a SHA-256 manifest; verify
and retain it alongside the generated compiled file before building.
The checksum of the currently deployed compiled file has not been captured:
saved browser permissions block the read-only NAS check. Do not substitute the
patch-script hash for that compiled-file hash.

## Validation

Twenty affected npm suites pass in an isolated Linux container with the real
application dependencies: password reset (29 checks), auth pages (17 checks),
temporary passwords, family menu, OIDC family policy, CCTV, Immich family policy,
recovery options, recovery-file cleanup, real recovery CLI, fork hygiene, portrait
fallback, suite registry, parallel runner, settings navigation, admin password
reset, reset-link precheck, OIDC token auth, redirect URI and email linking.

The fork suites are included in `npm test`, the CI job that invokes it, and the
parallel runner that reads that same chain. The browser-loader-dependent family
test uses the repository's loader. New suites are documented in `docs/test-suites.md`.

The earlier brand-mark failures were fork regressions, not upstream failures.
Auth-page assertions now cover the intended portrait/fallback contract. The
broader settings-navigation suite passes after LF normalization. A separate
fork reset-page global-reference regression found during validation is fixed.

Browser check: clean test instance → recovery page → back to login. The fallback
SVG rendered, zero broken images were present, operational details were absent,
and no browser warnings/errors were recorded. This does not test a real NAS
password, camera connection or Immich sign-in. The full upstream npm chain was
not rerun; the affected suites above were run.

NAS runtime changes are separate from this source review. Preserve private
configuration when deploying these templates. Historical commits and previously
shared archives may still contain the old deployment topology.
