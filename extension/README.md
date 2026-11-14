# SteamPulse Connect — Browser builds

Choose the folder matching your browser and load that folder as an unpacked extension.

| Folder | Browser |
|---|---|
| `chrome/` | Google Chrome |
| `edge/` | Microsoft Edge |
| `brave/` | Brave |
| `firefox/` | Mozilla Firefox |

## Install

- **Chrome:** open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `chrome`.
- **Edge:** open `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select `edge`.
- **Brave:** open `brave://extensions`, enable Developer mode, choose **Load unpacked**, and select `brave`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `firefox/manifest.json`. For permanent installation, the Firefox build must be signed by Mozilla AMO.

After installation, open Steam in a tab while signed in, then reload SteamPulse.

## Build folders

The root files in this directory are the shared source files. Run:

```bash
node extension/build.mjs
```

This regenerates all four browser folders from the shared source and their browser-specific manifests.

## Privacy

The extension reads Steam's `/dynamicstore/userdata/` endpoint using the browser's existing Steam session. The snapshot is stored locally and is only provided to SteamPulse when the site requests it. Steam passwords and session cookies are not read, exported, or sent to SteamPulse's backend.
