# CCTV Cameras for tvceb / Yuvomi

A manifest-version-1 module following [MODULES.md](https://github.com/ulsklyc/yuvomi/blob/main/MODULES.md).
The module does not patch Yuvomi core or open its database. Its companion service verifies
the current Yuvomi session, module enablement, and `ext:tvceb-cctv` permission for requests.

The viewer displays JPEG previews refreshed every 2, 5 or 10 seconds, with search, pause,
manual refresh, and an enlarged view. These are refreshed snapshots, not continuous video.
There are no PTZ, recording, configuration, audio, or delete endpoints. All browser-facing
camera endpoints are GET-only. Images stay in memory and use `Cache-Control: no-store`.
RTSP decoder processes stop after 30 seconds without a snapshot request. Camera URLs,
passwords and Surveillance Station session IDs are never returned to browsers.

## Module installation

Copy the contents of `module/` into your persistent modules directory as `tvceb-cctv/`.
On this Synology deployment that is `/volume1/docker/yuvomi/modules/tvceb-cctv/`.
Alternatively, ZIP the contents of `module/` and install through Settings → Modules →
Add custom module where the operator has enabled web installation. Approve/enable it
in Settings → Modules. Hand-copied modules start enabled per the module contract.

Keep `service/`, credentials, and Compose files outside the module directory: module
assets are readable by authenticated app users. The default service restricts cameras
to administrators. To permit household members, set `CCTV_ADMIN_ONLY=false` and grant
`ext:tvceb-cctv` read access in Yuvomi's role/member permissions. A `none` grant is denied.
Even a `write` grant never enables camera-changing operations.

## RTSP service on Synology

Use the provided `compose.yml` beside `service/`. Adjust the NAS bind address and external
Docker network to your installation. The current network is `tvceb-yuvomi_default`.
Create a private `secrets/rtsp.json` file using a camera/NVR viewer account:

```json
{
  "cameras": [
    {
      "id": 1,
      "name": "Channel 1",
      "url": "rtsp://VIEWER:URL_ENCODED_PASSWORD@CAMERA_IP:554/cam/realmonitor?channel=1&subtype=0"
    }
  ]
}
```

For this NVR format, channels are 1–8; subtype 0 selects the main stream, subtype 1 the
sub-stream. A sub-stream reduces decode load for previews. Use URL encoding for passwords
containing delimiters such as `@`, `:`, `#` or `?`. Put real credentials only in that private
file; do not commit them. Make the file owner UID 1000 (the container's node user), mode
600, and its containing directory mode 700. The file is mounted read-only as a Docker secret.

```sh
docker compose -f compose.yml config --quiet
docker compose -f compose.yml up -d --build
```

The service listens at `NAS_LAN_IP:3246` and authenticates against `http://tvceb:3000`.
Direct anonymous requests cannot access camera metadata or images. Keep that port on the
LAN and do not publish it through a tunnel. No changes to the camera/NVR are required.

## Same-origin reverse proxy

Add a location on the **existing** `home.example.invalid` proxy host:

- Location: `/api/extensions/tvceb-cctv/`
- Upstream: `http://NAS_LAN_IP:3246`
- Preserve the complete path and the incoming Cookie header.
- Keep buffering/caching disabled for this location. Do not add an anonymous auth bypass.

Use the matching prefix declared in the manifest. The app service worker bypasses `/api/`;
another prefix may cache private images. The normal app route remains pointed to port 3245.

## Optional Surveillance Station adapter

The service also supports Synology's documented Camera `List` and `GetSnapshot` v9 APIs.
Remove `RTSP_CONFIG_FILE`, set `SURVEILLANCE_URL` to a trusted DSM HTTPS origin, and mount
private viewer username/password files via `SS_USERNAME_FILE` and `SS_PASSWORD_FILE`.
Use a Surveillance Station user permitted only to view the selected cameras. The adapter
allowlists listing and snapshots; it cannot forward arbitrary API methods. `CCTV_CAMERA_IDS`
can restrict the exposed numeric camera IDs. TLS validation is never disabled.

`CCTV_CAMERA_IDS` applies to RTSP and Surveillance Station alike. Only listed
IDs are listed or served. Recorder URLs using `/cam/realmonitor` are converted
to `subtype=1` for previews. Other RTSP URLs retain their configured stream.
The viewer shares decoders per channel and limits simultaneous decoders to four;
busy previews can be retried. Bind the sidecar to loopback by default. If the
reverse proxy runs on another machine, explicitly set `CCTV_BIND_ADDRESS` to a
private LAN address and restrict inbound access there.

## Verification

```sh
node --test extensions/tvceb-cctv/test/service.test.mjs
```

Tests cover session and permission checks, disabled modules, anonymous access, rejected
mutations, upstream method restrictions, private metadata filtering, snapshot caching,
session renewal, invalid images, failed-login backoff, RTSP frame assembly, shared decoding,
idle cleanup, and credential-safe error messages. Real camera connectivity must also be
checked on the deployment network. A successful sidecar health check alone does not prove it.
