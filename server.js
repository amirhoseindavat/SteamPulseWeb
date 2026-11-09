import dns from "node:dns";
import express from "express";
import cors from "cors";
import { fetchJson, fetchJsonWithOptions, fetchSteamHeaderImage, mapWithConcurrency } from "./server/services/steamClient.js";
import { CACHE_TTL, cached, saveCache } from "./server/utils/cache.js";

import { registerMarketRoutes } from "./server/routes/market.js";
import { registerGameRoutes } from "./server/routes/games.js";
import { registerDiscoveryRoutes } from "./server/routes/discovery.js";
import { registerProfileRoutes } from "./server/routes/profile.js";

// Steam Store IPv6 connectivity is unreliable on some networks; prefer IPv4 for Node fetch.
dns.setDefaultResultOrder("ipv4first");

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const previousRegionalSellPrices = new Map();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

registerMarketRoutes(app, { fetchJson, mapWithConcurrency, previousRegionalSellPrices });

registerProfileRoutes(app, { fetchJson, fetchSteamHeaderImage, mapWithConcurrency });

const { fetchSteamBundles } = registerDiscoveryRoutes(app, { fetchJson, fetchJsonWithOptions, cached, saveCache, CACHE_TTL, mapWithConcurrency });

registerGameRoutes(app, { fetchJson, cached, saveCache, CACHE_TTL, mapWithConcurrency, fetchSteamBundles });

app.listen(PORT, () => {
  console.log(`SteamPulse API listening on http://localhost:${PORT}`);
});
