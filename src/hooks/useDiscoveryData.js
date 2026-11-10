import { useEffect, useState } from "react";
import { getDiscovery, getFreeGames } from "../services/steamPulseApi";

export function useDiscoveryData(region) {
  const [discovery, setDiscovery] = useState({ newReleases: [], upcoming: [], preorders: [], preordersError: "", topSellers: [] });
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryTab, setDiscoveryTab] = useState("trending");
  const [freeGames, setFreeGames] = useState([]);
  const [freeGamesLoading, setFreeGamesLoading] = useState(true);
  const [freeGamesError, setFreeGamesError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setDiscoveryLoading(true);
    setDiscoveryError("");
    getDiscovery(region, false, controller.signal)
      .then((data) => setDiscovery({
        newReleases: data.newReleases || [],
        upcoming: data.upcoming || [],
        preorders: data.preorders || [],
        preordersError: data.preordersError || "",
        topSellers: data.topSellers || []
      }))
      .catch((e) => {
        if (!controller.signal.aborted) setDiscoveryError(e.message || "Game discovery is temporarily unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setDiscoveryLoading(false); });
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
