import { useEffect, useState } from "react";
import { getDiscovery, getFreeGames, getTopSellers, getStoreTakeover } from "../services/steamPulseApi";

export function useDiscoveryData(region) {
  const [discovery, setDiscovery] = useState({ newReleases: [], upcoming: [], preorders: [], preordersError: "", topSellers: [] });
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState("");
  const [topSellersLoading, setTopSellersLoading] = useState(true);
  const [storeTakeover, setStoreTakeover] = useState(null);
  const [discoveryTab, setDiscoveryTab] = useState("trending");
  const [freeGames, setFreeGames] = useState([]);
  const [freeGamesLoading, setFreeGamesLoading] = useState(true);
  const [freeGamesError, setFreeGamesError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setDiscoveryLoading(true);
    setDiscoveryError("");
    getDiscovery(region, false, controller.signal)
      .then((data) => setDiscovery((current) => ({
        ...current,
        newReleases: data.newReleases || [],
        upcoming: data.upcoming || [],
        preorders: data.preorders || [],
        preordersError: data.preordersError || ""
      })))
      .catch((e) => {
        if (!controller.signal.aborted) setDiscoveryError(e.message || "Game discovery is temporarily unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setDiscoveryLoading(false); });
    return () => controller.abort();
  }, [region]);

  useEffect(() => {
    const controller = new AbortController();
    setTopSellersLoading(true);
    setDiscovery((current) => ({ ...current, topSellers: [] }));
    getTopSellers(region, false, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setDiscovery((current) => ({ ...current, topSellers: data.items || [] }));
          setTopSellersLoading(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDiscoveryError(error.message || "Steam Top Sellers are temporarily unavailable.");
          setTopSellersLoading(false);
        }
      });
    return () => controller.abort();
  }, [region]);


  useEffect(() => {
    const controller = new AbortController();
    setStoreTakeover(null);
    getStoreTakeover(region, false, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setStoreTakeover(data.takeover || null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn("Steam Store Takeover unavailable:", error.message);
          setStoreTakeover(null);
        }
      });
    return () => controller.abort();
  }, [region]);

  useEffect(() => {
    const controller = new AbortController();
    setFreeGamesLoading(true);
    setFreeGamesError("");
    getFreeGames(region, false, controller.signal)
      .then((data) => setFreeGames(data.items || []))
      .catch((e) => {
        if (!controller.signal.aborted) setFreeGamesError(e.message || "Free promotions are temporarily unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setFreeGamesLoading(false); });
    return () => controller.abort();
  }, [region]);

  return {
    discovery,
    discoveryLoading,
    discoveryError,
    topSellersLoading,
    storeTakeover,
    discoveryTab,
    setDiscoveryTab,
    setDiscoveryLoading,
    setDiscoveryError,
    setDiscovery,
    freeGames,
    freeGamesLoading,
    setFreeGamesLoading,
    freeGamesError,
    setFreeGamesError,
    setFreeGames
  };
}
