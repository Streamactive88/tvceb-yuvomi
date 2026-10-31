# Family home candidate

Status: source prepared; these changes are not installed on the NAS. The red/gold
family theme and readable Nunito Sans font remain. Family home groups Plan,
Household, People and Finance, and has shortcuts for photos, messages and guides.

Install extensions/tvceb-family/module, extensions/tvceb-knowledgebase/module and
extensions/tvceb-whatsapp/module into persistent module folders named tvceb-family,
tvceb-knowledgebase and tvceb-whatsapp. Keep existing CCTV and Vaultwarden rights.
The old custom Immich adapter is removed: the referenced photo installation now uses
Family Photo Share and PhotoPrism. Preserve photo originals, uploads and album ACLs.
Clear obsolete Immich screensaver settings privately; the inherited upstream optional
integration does not mean Immich should be reinstalled.

## Family service

Copy extensions/tvceb-family/service-config.example.json to that extension's private
secrets/family-services.json. Prepare data/ writable by container UID 1000. Set the
exact HTTPS FAMILY_PUBLIC_ORIGIN and existing TVCEB Docker network in Compose.
Persistent SQLite settings override the example after first start.

Proxy only /api/extensions/tvceb-family/ on the existing portal origin to the private
sidecar port 3030. Preserve Cookie and Origin, forward HTTPS correctly and do not
cache. The sample loopback port 3247 is for a host proxy; a containerized proxy
needs the private Docker network instead. Keep all other portal routing unchanged.
Never expose the sidecar publicly. It verifies TVCEB sessions with a maximum two-second
cache and never reads the core database or stores passwords.

Enable the three modules, then choose Settings -> Modules -> Family home, also
linked as Family setup on the home page. A system administrator can set service URLs,
the private WhatsApp group invitation, who can edit guides, the simple menu, member
display names, family roles and individual module access. Core account/permissions
APIs enforce these changes; this screen does not grant service administrator rights.

Everyone with Knowledgebase Use / edit access can edit published articles and their
own pending drafts. Parents publish and archive. Children can submit new articles
for parent review; other children's drafts remain private. Read-only users cannot
write. Version checks prevent stale updates. The administrator can instead choose
parents-only editing. Article text is escaped plain text.

Family messages defaults to TVceb Family. Short instructions explain using WhatsApp
on a phone and scanning a QR code to link a computer. A parent can add the official
private invitation in settings. Each person links their own eligible WhatsApp account;
TVCEB never receives phone credentials or messages. Log out on shared computers.

The optional simple menu shortens navigation while every permitted activity stays in
Family home. It falls back to the complete menu if Family home is unavailable.

Back up extensions/tvceb-family/data/family-hub.sqlite separately using a stopped
service or a SQLite-consistent snapshot. Core TVCEB backups do not include this DB.

See [SSO preparation](extensions/tvceb-sso/README.md) for the broker and adapters.
Retain current working sign-ins until real-account callback and permission checks pass.
