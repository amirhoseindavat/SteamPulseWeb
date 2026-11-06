import { useEffect, useState } from "react";
import { readApiResponse } from "../utils/api";

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

      const response = await fetch("/api/ownership-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(steamApiKey ? { "X-Steam-API-Key": steamApiKey } : {})
        },
        body: JSON.stringify({ profile: steamProfile, appids })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not check this Steam library.");
      setOwnership(data);
    } catch (error) {
      setOwnershipError(error.message || "Ownership check failed.");
    } finally {
      setOwnershipLoading(false);
    }
  }

  useEffect(() => {
    if (currentPage === "game" && game?.appid && game.type !== "dlc" && steamProfile && steamApiKey) {
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
