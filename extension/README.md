# SteamPulse Connect

A minimal Chromium Manifest V3 extension that syncs the current Steam Store account snapshot to SteamPulse.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this `extension` folder.
5. Open a Steam Store tab while signed in and wait a moment.
6. Open or reload SteamPulse.

Supported SteamPulse pages:
- `https://amirhoseindavat.github.io/SteamPulseWeb/`
- `http://localhost:5173/`
- `http://127.0.0.1:5173/`

## Data handling

The extension reads Steam's `/dynamicstore/userdata/` endpoint with the browser's existing Steam session. The response is stored in `chrome.storage.local` and passed to SteamPulse only when the SteamPulse page requests it.

The extension does not read, export, or transmit Steam passwords or session cookies. Account data is not sent to a SteamPulse backend.

The first version provides the raw Steam snapshot for wishlist, owned AppIDs, owned PackageIDs, cart IDs, and recommendation metadata.