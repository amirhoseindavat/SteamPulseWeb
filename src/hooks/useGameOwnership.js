import { useEffect, useState } from "react";
import { checkSteamOwnership } from "../services/steamPulseApi";

export function useGameOwnership({ game, currentPage, steamProfile, steamApiKey }) {
  const [ownership, setOwnership] = useState(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState("");

  async function checkOwnership() {
    if (!steamProfile.trim() || !game) {
      setOwnershipError("Add your Steam profile in Settings first.");
      return;
    }

    setOwnershipLoading(true);
    setOwnershipError("");

    try {
      const appids = [...new Set([
        Number(game.appid),
        ...(game.dlc || []).map((item) => Number(item.appid))
      ].filter(Number.isFinite))];

      const data = await checkSteamOwnership(steamProfile, appids, steamApiKey);
      setOwnership(data);
    } catch (error) {
      setOwnershipError(error.message || "Ownership check failed.");
    } finally {
      setOwnershipLoading(false);
    }
  }

  useEffect(() => {
    if (currentPage === "game" && game?.appid && String(game.type || "").toLowerCase() !== "hardware" && steamProfile && steamApiKey) {
      checkOwnership();
    }
  }, [currentPage, game?.appid, steamProfile, steamApiKey]);

  function resetOwnership() {
    setOwnership(null);
    setOwnershipError("");
    setOwnershipLoading(false);
  }

  return {
    ownership,
    ownershipLoading,
    ownershipError,
    checkOwnership,
    resetOwnership
  };
}
