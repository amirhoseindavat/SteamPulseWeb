import { requestJson } from "./apiClient";

export const getGame = (id, region) =>
  requestJson(`/api/game/${encodeURIComponent(id)}?cc=${encodeURIComponent(region)}`, {}, "Unable to load this game.");

export const getGameBundles = (id, region) =>
  requestJson(`/api/game/${encodeURIComponent(id)}/bundles?cc=${encodeURIComponent(region)}`, {}, "Could not load game bundles.");

export const getGameDlc = (id, region, offset, limit = 24) =>
  requestJson(`/api/game/${encodeURIComponent(id)}/dlc?cc=${encodeURIComponent(region)}&offset=${encodeURIComponent(offset)}&limit=${encodeURIComponent(limit)}`, {}, "Unable to load more DLC.");

export const searchGames = (term, region) =>
  requestJson(`/api/search?term=${encodeURIComponent(term.trim())}&cc=${encodeURIComponent(region)}`, {}, "Search failed.");

export const getDiscovery = (region, refresh = false) =>
  requestJson(`/api/discover?cc=${encodeURIComponent(region)}${refresh ? "&refresh=1" : ""}`, {}, "Could not load game discovery.");

export const getFreeGames = (region, refresh = false) =>
  requestJson(`/api/free-games?cc=${encodeURIComponent(region)}${refresh ? "&refresh=1" : ""}`, {}, "Could not load free Steam games.");

export const getShopData = () =>
  requestJson("/api/shop-data", {}, "Could not load live key prices.");

export const getRegionalKeyPrice = (region) =>
  requestJson(`/api/key-price?region=${encodeURIComponent(region)}`, {}, "Could not load this region's Steam key price.");

export const getMarketRegions = () =>
  requestJson("/api/market-regions", {}, "Could not load Steam Market regional prices.");

export const getCartDetails = (region, appIds) =>
  requestJson(`/api/cart-details?cc=${encodeURIComponent(region)}&apps=${encodeURIComponent(appIds)}`, {}, "Could not load cart details.");

export const getSteamProfile = (profile, apiKey = "") =>
  requestJson(`/api/steam-profile?profile=${encodeURIComponent(profile)}`, {
    headers: apiKey ? { "X-Steam-API-Key": apiKey } : {}
  }, "Could not load the Steam profile.");

export const checkSteamOwnership = (profile, appids, apiKey = "") =>
  requestJson("/api/ownership-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { "X-Steam-API-Key": apiKey } : {}) },
    body: JSON.stringify({ profile, appids })
  }, "Could not check this Steam library.");
