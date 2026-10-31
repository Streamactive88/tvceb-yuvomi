# Vaultwarden menu module

Copy `module/` to `/volume1/docker/yuvomi/modules/tvceb-vaultwarden` and restart
TVCEB to discover it. The module opens the existing HTTPS family vault; passwords
and vault sessions stay with Vaultwarden. It does not embed the vault or store
its credentials. Keep the existing `family-vaultwarden` container and data volume.

The deployment uses `https://vault.int.s8.net.au/`. Edit the launcher URL in
`module/index.js` if your installation uses another hostname.
