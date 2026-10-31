# TVCEB family setup

The family theme is in `public/styles/family-theme.css`: red primary controls, gold details,
accessible light/dark text colours and locally hosted Nunito Sans. The font licence is in
`public/fonts/nunito-sans/OFL.txt`. The supplied family illustration is deployed privately
at `public/assets/family/family.png`; it is excluded from Git.

Navigation groups use the built-in modules:

- Plan: Tasks, Calendar, Rewards, Notes, Contacts, Schedule.
- Household: Kitchen (Meals, Recipes, Shopping, Pantry), Housekeeping, Waste collection,
  Documents, Inventory.
- People: Health, Birthdays.
- Finance: Budget.
- Settings: Family, Reminders, API Tokens, Backup, with direct shortcuts in Family Apps.

`extensions/tvceb-family/module/` installs as `tvceb-family/` in the persistent modules
directory. It links to existing features and separate family services without sharing
credentials, embedding vault contents or storing their tokens in browser assets.

Private service hostnames are `vault.int.s8.net.au` and `photos.int.s8.net.au`.
Home Assistant uses its existing local URL, `http://192.168.8.20:8123`.
The HTTPS proxies were verified on 31 October 2026 with valid certificates and
WebSocket support. Vaultwarden retains its existing data and disabled public
registration. Home Assistant retains its existing local sign-in. The services
keep their own permissions; the portal provides launchers, not shared sessions.

Shopping uses tvceb's shared Kitchen shopping lists; no separate grocery database is
introduced. Documents use the existing persistent `/documents` mount. Photo-album
screensaver access additionally needs an Immich API key and selected album, configured
in Settings → Household → Integrations. Never put that key into the module or Git.

Deployment uses `tvceb:2.82.0-original-menu1`. Schedule, Inventory and Waste collection
are enabled with the other requested built-in modules. Immich's existing Family
Album is selected; adding its private read-only API key is still required for
the portal's photo screensaver. Home Assistant's private sign-in remains a user
step. The Family Apps module is installed in the persistent modules directory.

Navigation now follows the original upstream menu order and grouping. The
custom Family menu is hidden from navigation; its page remains available by URL.
All built-in modules are enabled and menu visibility/order overrides are reset.
Previous menu preferences are saved privately on the NAS for rollback.
**CCTV Cameras** and **Vaultwarden** are separate custom module entries.
CCTV retains its read-only service and existing account restrictions.
Vaultwarden opens the existing family vault with its own authentication.
Existing family roles and data permissions are preserved.
The shared **Family Groceries** list and a **Family** document folder are ready.
Synology family SSO is enabled for TVCEB and Immich. See `FAMILY-SSO.md` for
access restrictions. TVCEB family sign-in is confirmed; Immich still needs a
real-account sign-in check.

Validation: the 15 focused original-navigation checks pass. The broader
navigation suite has two existing failures in Gravatar copy and Health markup,
outside these changes. Desktop and 390px mobile login views were checked, with
the local font and family illustration loaded and no horizontal overflow.
