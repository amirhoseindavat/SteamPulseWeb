import express from "express";
import cors from "cors";
import { fetchJson, fetchJsonWithOptions, fetchSteamHeaderImage, fetchSteamDbLogo, mapWithConcurrency } from "./server/services/steamClient.js";
import { CACHE_TTL, cached, saveCache } from "./server/utils/cache.js";

import { registerMarketRoutes } from "./server/routes/market.js";
import { registerGameRoutes } from "./server/routes/games.js";
import { registerDiscoveryRoutes } from "./server/routes/discovery.js";
import { registerProfileRoutes } from "./server/routes/profile.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

registerMarketRoutes(app, { fetchJson, mapWithConcurrency, previousRegionalSellPrices });

registerProfileRoutes(app, { fetchJson, fetchSteamHeaderImage, mapWithConcurrency });

const { fetchSteamBundles, decodeSteamHtml } = registerDiscoveryRoutes(app, { fetchJson, fetchJsonWithOptions, cached, saveCache, CACHE_TTL, mapWithConcurrency });

registerGameRoutes(app, { fetchJson, cached, saveCache, CACHE_TTL, mapWithConcurrency, fetchSteamBundles });

app.listen(PORT, () => {
  console.log(`SteamPulse API listening on http://localhost:${PORT}`);
});
