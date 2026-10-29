# SteamPulseWeb

SteamPulse is a dark, responsive React dashboard for exploring Steam game data.

## Features
- Search the Steam Store by game title using the server-side `/api/search` endpoint.
- Search results show title, thumbnail, and Steam AppID; selecting a result loads its profile.
- Load a game directly by AppID.
- Show Steam Store description, developers, publishers, release date, genres, categories, platform support, current regional price, Metacritic score, recommendation count, screenshots, and current player count when Steam provides the data.
- Switch supported price regions.
- Responsive layout for desktop and mobile.
- Five-minute in-memory cache for API responses.

## Requirements
- Node.js 18 or newer (Node 20 LTS recommended)
- Internet access to Steam endpoints

## Run locally
```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Vite proxies `/api` requests to the Express API on port 3001.

## Useful endpoints
- `GET /api/search?term=elden%20ring&cc=US`
- `GET /api/game/1091500?cc=US`
- `GET /api/health`

## Notes
- The default game is Cyberpunk 2077 (AppID `1091500`).
- Store search requests are made server-side to avoid browser CORS issues.
- Steam's StoreBrowse asset endpoint is undocumented and may change or omit data for some titles.
- Player counts can be unavailable for some games.
- Steam account ownership is not inferred; that requires user-specific authenticated library data.
- The app does not invent price history, language support, or Steam review percentages.
- For production deployment, add request throttling, persistent caching, and suitable server-side cache controls.
