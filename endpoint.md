# SteamPulseWeb Endpoints

> Endpoint reference for the SteamPulseWeb backend.
>
> **Repository:** `amirhoseindavat/SteamPulseWeb`  
> **Branch documented:** `refactor/modular-architecture`  
> **Backend:** Express.js (`server.js`, default port `3001`)
>
> This document covers the backend routes exposed by SteamPulseWeb and the external services/endpoints currently referenced by the backend. External Steam endpoints are unofficial or community-facing unless explicitly identified as Steam Web API methods. Availability, response formats, and rate limits are controlled by their providers.

## 1. Internal SteamPulse API

Base URL in local development: `http://localhost:3001`

All routes below are registered by the Express server.

| Method | Endpoint | Query / body | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | Basic health check. Returns `{ "ok": true }`. |
| GET | `/api/market-regions` | — | Retrieves TF2 Mann Co. Supply Crate Key market prices and order data for the configured regions. |
| GET | `/api/key-price` | `region` (optional; defaults to `US`) | Gets the current TF2 key sell price for a supported Steam region, including gross/net price and cache status. |
| GET | `/api/shop-data` | — | Retrieves live AresGame/CodeMage shop data and augments it with the latest cached US Steam key price when available. |
| GET | `/api/steam-profile` | `profile` (SteamID64, profile URL, or vanity name); optional `X-Steam-API-Key` header | Aggregates Steam profile, games, badges, friends, profile items, avatar frame, bans, and related profile data. Requires `STEAM_API_KEY` on the server or the request header. |
| POST | `/api/ownership-check` | JSON body containing the profile identifier and app IDs to check | Checks whether the supplied Steam account owns the requested apps. Uses the Steam Web API and Store app details. |
| GET | `/api/search` | `term`, `cc` (default `US`), `l` (default `english`) | Searches Steam Store products and returns normalized search results. Terms shorter than two characters return an empty list. |
| GET | `/api/store-takeover` | `cc` (default `US`); internal `refresh=1` bypasses the normal cache path | Retrieves the current Steam Store takeover/promotion content. Supports stale-while-refresh behavior. |
| GET | `/api/top-sellers` | `cc` (default `US`); internal `refresh=1` bypasses the normal cache path | Retrieves the paid Top Sellers list, combining Steam search results with featured-category data. |
| GET | `/api/discover` | `cc` (default `US`); internal `refresh=1` bypasses the normal cache path | Aggregates New Releases, Upcoming, Pre-orders, and Top Sellers for the discovery page. |
| GET | `/api/free-games` | `cc` (default `US`); internal `refresh=1` bypasses the normal cache path | Finds limited-time Steam promotions such as Free to Keep and Free Weekend, excluding permanently free-to-play titles. |
| GET | `/api/cart-details` | `apps` (comma-separated AppIDs), `cc` (default `US`) | Loads localized app names, images, prices, discounts, and free status for cart items. |
| GET | `/api/game/:appid` | `cc` (default `US`) | Loads game details, regional/US pricing, player count, Steam Deck compatibility, library artwork, and the SteamCMD library logo. |
| GET | `/api/game/:appid/bundles` | `cc` (default `US`) | Retrieves Steam bundles associated with a game and their localized details. |
| GET | `/api/game/:appid/dlc` | `cc` (default `US`) | Retrieves DLC associated with a game, including localized app details. |
| GET | `/api/game-size/:appid` | — | **Experimental / provider-dependent.** Attempts to retrieve Windows/English install and download size information from SteamDB. |

### Internal API notes

- Region parameters use Steam country codes (for example, `US`, `UA`, `TR`).
- Most Store/discovery responses are cached by the backend. Discovery, Top Sellers, Store Takeover, and Free Games use the shared discovery cache and background refresh mechanism.
- The `refresh=1` parameter is primarily an internal background-refresh mechanism; it is not intended as a public cache-control contract.
- `/api/game-size/:appid` is retained as an experimental route. SteamDB may return an anti-bot/JavaScript challenge, so this endpoint is not guaranteed to work.

## 2. External Steam Store endpoints

These are upstream GET requests made by the backend.

| Endpoint | Main parameters | Used for |
|---|---|---|
| `https://store.steampowered.com/api/appdetails` | `appids`, `cc`, `l` | Main source for app/game details, localized pricing, cart items, DLC metadata, ownership validation, and discovery type checks. |
| `https://store.steampowered.com/api/storesearch/` | `term`, `cc`, `l` | Steam Store search. |
| `https://store.steampowered.com/api/featuredcategories/` | `cc`, `l` | Featured categories, including Top Sellers, New Releases, and Coming Soon/Upcoming. |
| `https://store.steampowered.com/search/` | Search/filter query parameters | HTML search results used to discover limited-time free promotions. |
| `https://store.steampowered.com/search/results/` | `query`, `start`, `count`, `dynamic_data`, `sort_by`, `snr`, `filter`, `category1`, `os`, `cc`, `l`, `infinite` | Full ranked Top Sellers search results. |
| `https://store.steampowered.com/search/results?sort_by=Price_DESC&force_infinite=1&hwtype=0&category1=998&filter=popularcomingsoon&ndl=1&snr=1_7_7_popularcomingsoon_7` | Also adds `cc` and `l` | Paid Popular Upcoming / Pre-order results. Rows are parsed from the returned HTML/JSON response. |
| `https://store.steampowered.com/` | `cc`, `l` | Steam Store homepage HTML, used to locate the Store Takeover/promo content and for discovery parsing. |
| `https://store.steampowered.com/app/{appid}/` | `cc`, `l` where applicable | Game page HTML, including bundle discovery. Also used to construct user-facing Store links. |
| `https://store.steampowered.com/app/{appid}/bundles/` | `cc`, `l` | Game-specific bundle listing page. |
| `https://store.steampowered.com/actions/ajaxresolvebundles` | `bundleids`, `cc`, `l` | Resolves bundle IDs into bundle details. |
| `https://store.steampowered.com/sub/{packageid}/` | — | User-facing Steam package/subscription link generated for editions/packages. |
| `https://store.steampowered.com/app/{appid}/` | — | User-facing game and DLC links. |

## 3. Steam Web API endpoints

Base URL: `https://api.steampowered.com`

### Game information

| Endpoint | Parameters used | Purpose |
|---|---|---|
| `/ISteamUserStats/GetNumberOfCurrentPlayers/v1/` | `appid` | Current player count for a game. |
| `/IStoreBrowseService/GetItems/v1/` | `input_json` containing app ID, language, country code, and `include_assets: true` | Store library assets, including the library background/hero artwork. |
| `/ISteamNews/GetNewsForApp/v2/` | `appid`, `count`, `feeds`, `maxlength`, `format` | Game news and Steam Community announcements. |
| `/ISteamNews/GetNewsForApp/v2/` | `appid`, `count`, `maxlength`, `format` | Additional/external game news feed retrieval. |

### Steam Deck compatibility

| Endpoint | Parameters used | Purpose |
|---|---|---|
| `https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport` | `nAppID`, `l` | Steam Deck compatibility category and criteria. This is a Steam Store AJAX endpoint, not a Steam Web API method. |

### Steam profile

The following endpoints are called by `/api/steam-profile` (and some are reused by `/api/ownership-check`):

| Endpoint | Parameters used | Purpose |
|---|---|---|
| `/ISteamUser/ResolveVanityURL/v1/` | `key`, `vanityurl` | Resolves a custom Steam profile URL/name to SteamID64. |
| `/ISteamUser/GetPlayerSummaries/v2/` | `key`, `steamids` | Basic public player summary and profile information. |
| `/IPlayerService/GetOwnedGames/v1/` | `key`, `steamid`, `include_appinfo=true`, `include_played_free_games=true` | Owned games and app metadata. |
| `/IPlayerService/GetSteamLevel/v1/` | `key`, `steamid` | Steam account level. |
| `/IPlayerService/GetBadges/v1/` | `key`, `steamid` | Earned badges and badge progress. |
| `/IPlayerService/GetFavoriteBadge/v1/` | `key`, `steamid` | Favorite badge information. |
| `/ISteamUser/GetFriendList/v1/` | `key`, `steamid`, `relationship=friend` | Public friends list. |
| `/IPlayerService/GetRecentlyPlayedGames/v1/` | `key`, `steamid`, `count=0` | Recently played games. |
| `/IPlayerService/GetProfileBackground/v1/` | `key`, `steamid` | Equipped profile background. |
| `/IPlayerService/GetProfileCustomization/v1/` | `key`, `steamid` | Profile customization data. |
| `/IPlayerService/GetProfileItemsEquipped/v1/` | `key`, `steamid` | Equipped profile items, including avatar-frame data when available. |
| `/IPlayerService/GetAnimatedAvatar/v1/` | `key`, `steamid` | Animated avatar information. |
| `/IPlayerService/GetAvatarFrame/v1/` | `key`, `steamid` | Avatar frame information/fallback. |
| `/ISteamUser/GetPlayerBans/v1/` | `key`, `steamids` | VAC/game-ban and community-ban information. |

## 4. Other external services

| Endpoint | Method | Used for / notes |
|---|---|---|
| `https://api.steamcmd.net/v1/info/{appid}` | GET | SteamCMD app metadata. SteamPulse reads `common.library_assets_full.library_logo.image2x.english` to build the English 2x game-logo URL. |
| `https://steamcommunity.com/market/itemordershistogram` | GET | TF2 Mann Co. Supply Crate Key order book: lowest sell, highest buy, order counts, and price graph. Used by both market regions and the key-price calculator. |
| `https://steamcommunity.com/market/listings/440/Mann-Co.-Supply-Crate-Key/` | Referer / listing page | Listing context for the TF2 key market histogram request. |
| `https://api.codemage.ir/Projects/SteamPulse/ShopData/` | GET | Live shop/key price and stock information supplied by the CodeMage/AresGame API. |
| `https://steamdb.info/app/{appid}/depots/` | GET (HTML page) | **Experimental / unreliable.** Source attempted by `/api/game-size/:appid` to parse Windows/English install and download sizes. SteamDB may block automated requests with a JavaScript/anti-bot challenge. |
| `https://steamcommunity.com/profiles/{steamid}/` | GET (HTML page) | Public Steam profile HTML used as a supplementary source for profile details/assets not fully available from the API responses. |

## 5. Static Steam asset/CDN URLs

These are asset URLs, not JSON API endpoints. They are included because the application builds or consumes them directly.

| URL pattern | Purpose |
|---|---|
| `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg` | Official game header image/fallback artwork. |
| `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/{asset}` | SteamCMD-derived library logo or StoreBrowse asset URL. |
| `https://shared.steamstatic.com/store_item_assets/steam/apps/{appid}/library_hero.jpg` | Library hero/background asset fallback. |
| `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/{appid}/{asset}` | Steam Store asset CDN variant used by the Steam client helper. |
| `https://shared.fastly.steamstatic.com/community_assets/images/{asset}` | Steam Community profile assets. |
| `https://community.fastly.steamstatic.com/public/images/badges/{asset}` | Badge artwork. |

## 6. Notes and maintenance

- Steam Store endpoints such as `appdetails`, `storesearch`, `featuredcategories`, search-results pages, and AJAX actions are not all formally documented public APIs. Their response formats can change without notice.
- Steam Web API methods generally require a Steam API key. Keep `STEAM_API_KEY` server-side; never expose it in browser code or commit it to the repository.
- Steam Market histogram requests can be rate-limited or rejected depending on request headers, region, and Steam availability.
- SteamCMD metadata and Steam static asset URLs are separate services: SteamCMD supplies metadata/asset paths, while the Steam CDN serves the actual image files.
- SteamDB game-size retrieval is experimental and should not be treated as a reliable source until anti-bot access is resolved.
- This document describes endpoints found in the current backend implementation. If a new upstream request or Express route is added, update this file in the same change.
