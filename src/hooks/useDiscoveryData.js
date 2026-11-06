import { useEffect, useState } from "react";
import { readApiResponse } from "../utils/api";

export function useDiscoveryData(region) {
  const [discovery, setDiscovery] = useState({ newReleases: [], upcoming: [], preorders: [], preordersError: "", topSellers: [] });
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryTab, setDiscoveryTab] = useState("trending");
  const [freeGames, setFreeGames] = useState([]);
  const [freeGamesLoading, setFreeGamesLoading] = useState(true);
  const [freeGamesError, setFreeGamesError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDiscoveryLoading(true);
    setDiscoveryError("");
    fetch(`/api/discover?cc=${region}`)
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || data.detail || "Could not load game discovery.");
        return data;
      })
      .then((data) => {
        if (!cancelled) setDiscovery({
          newReleases: data.newReleases || [],
          upcoming: data.upcoming || [],
          preorders: data.preorders || [],
          preordersError: data.preordersError || "",
          topSellers: data.topSellers || []
        });
      })
      .catch((e) => {
        if (!cancelled) setDiscoveryError(e.message || "Game discovery is temporarily unavailable.");
      })
      .finally(() => { if (!cancelled) setDiscoveryLoading(false); });
    return () => { cancelled = true; };
  }, [region]);

  useEffect(() => {
    let cancelled = false;
    setFreeGamesLoading(true);
    setFreeGamesError("");
    fetch(`/api/free-games?cc=${region}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load free Steam games.");
        return data;
      })
      .then((data) => { if (!cancelled) setFreeGames(data.items || []); })
      .catch((e) => { if (!cancelled) setFreeGamesError(e.message || "Free promotions are temporarily unavailable."); })
      .finally(() => { if (!cancelled) setFreeGamesLoading(false); });
    return () => { cancelled = true; };
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
