import { requestJson } from "./apiClient";

const withSignal = (signal) => signal ? { signal } : {};

export const getGame = (id, region, signal) =>
  requestJson(`/api/game/${encodeURIComponent(id)}?cc=${encodeURIComponent(region)}`, withSignal(signal), "Unable to load this game.", { cacheTtl: 60000 });

export const getGameBundles = (id, region, signal) =>
  requestJson(`/api/game/${encodeURIComponent(id)}/bundles?cc=${encodeURIComponent(region)}`, withSignal(signal), "Could not load game bundles.", { cacheTtl: 60000 });

export const getGameDlc = (id, region, offset, limit = 24, signal) =>
  requestJson(`/api/game/${encodeURIComponent(id)}/dlc?cc=${encodeURIComponent(region)}&offset=${encodeURIComponent(offset)}&limit=${encodeURIComponent(limit)}`, withSignal(signal), "Unable to load more DLC.", { cacheTtl: 60000 });

export const searchGames = (term, region, signal) =>
  requestJson(`/api/search?term=${encodeURIComponent(term.trim())}&cc=${encodeURIComponent(region)}`, withSignal(signal), "Search failed.", { cacheTtl: 20000 });

export const getDiscovery = (region, refresh = false, signal) =>
  requestJson(`/api/discover?cc=${encodeURIComponent(region)}${refresh ? "&refresh=1" : ""}`, withSignal(signal), "Could not load game discovery.", { cacheTtl: 60000 });

export const getFreeGames = (region, refresh = false, signal) =>
  requestJson(`/api/free-games?cc=${encodeURIComponent(region)}${refresh ? "&refresh=1" : ""}`, withSignal(signal), "Could not load free Steam games.", { cacheTtl: 60000 });

export const getShopData = (signal) =>
  requestJson("/api/shop-data", withSignal(signal), "Could not load live key prices.", { cacheTtl: 15000 });

export const getRegionalKeyPrice = (region, signal) =>
  requestJson(`/api/key-price?region=${encodeURIComponent(region)}`, withSignal(signal), "Could not load this region's Steam key price.", { cacheTtl: 30000 });

export const getMarketRegions = (signal) =>
  requestJson("/api/market-regions", withSignal(signal), "Could not load Steam Market regional prices.", { cacheTtl: 30000 });

export const getCartDetails = (region, appIds, signal) =>
  requestJson(`/api/cart-details?cc=${encodeURIComponent(region)}&apps=${encodeURIComponent(appIds)}`, withSignal(signal), "Could not load cart details.", { cacheTtl: 15000 });

export const getSteamProfile = (profile, apiKey = "", signal) =>
  requestJson(`/api/steam-profile?profile=${encodeURIComponent(profile)}`, {
    ...withSignal(signal),
    headers: apiKey ? { "X-Steam-API-Key": apiKey } : {}
  }, "Could not load the Steam profile.");

export const checkSteamOwnership = (profile, appids, apiKey = "", signal) =>
  requestJson("/api/ownership-check", {
    ...withSignal(signal),
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { "X-Steam-API-Key": apiKey } : {}) },
    body: JSON.stringify({ profile, appids })
  }, "Could not check this Steam library.");
