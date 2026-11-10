import { useRef, useState } from "react";
import { readApiResponse } from "../utils/api";

export function useGameData({
  region, appid, setAppid, setCurrentPage, setSearchOpen, setInputId, setQuery, setActiveTab
}) {
  const [game, setGame] = useState(null);
  const [gameBackground, setGameBackground] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMoreDlc, setLoadingMoreDlc] = useState(false);
  const [error, setError] = useState("");
  const [regionalPriceInput, setRegionalPriceInput] = useState("");
  const [selectedEditionName, setSelectedEditionName] = useState("");
  const [purchaseTab, setPurchaseTab] = useState("editions");
  const gameRequestRef = useRef(0);

  function invalidateGameRequest() {
    gameRequestRef.current += 1;
  }

  async function loadGame(id = appid, cc = region) {
    if (!/^\d+$/.test(String(id))) {
      setError("Enter a valid numeric Steam AppID.");
      return;
    }

    setCurrentPage("game");
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const currentPath = window.location.hash.startsWith("#/")
      ? window.location.hash.slice(1)
      : (basePath && window.location.pathname.startsWith(basePath)
        ? window.location.pathname.slice(basePath.length) || "/"
        : window.location.pathname);
    if (currentPath !== "/game/" + id) {
      window.history.pushState(null, "", basePath + "/game/" + id);
    }

    const requestId = ++gameRequestRef.current;
    setLoading(true);
    setError("");
    setSearchOpen(false);
    setGame(null);
    setGameBackground(null);
    setRegionalPriceInput("");
    setSelectedEditionName("");
    setPurchaseTab("editions");

    try {
      const response = await fetch("/api/game/" + id + "?cc=" + cc);
      const data = await readApiResponse(response);
      if (requestId !== gameRequestRef.current) return;
      if (!response.ok) throw new Error(data.error || data.detail || "Unable to load this game.");

      setGame(data);
      const isDlcPage = String(data.type || "").toLowerCase() === "dlc";
      const randomScreenshot = Array.isArray(data.screenshots) && data.screenshots.length
        ? data.screenshots[Math.floor(Math.random() * data.screenshots.length)]
        : null;
      const preferredBackground = isDlcPage
        ? (randomScreenshot || data.background_raw || null)
        : (typeof data.background_raw === "string" && /page_bg_raw/i.test(data.background_raw)
          ? data.background_raw
          : (randomScreenshot || data.background_raw || null));
      setGameBackground(preferredBackground);

      const baseGamePrice = data.price_overview?.final != null ? Number(data.price_overview.final) / 100 : null;
      const defaultEdition = (data.editions || []).find((edition) =>
        edition.priceValue != null && baseGamePrice != null &&
        Math.abs(Number(edition.priceValue) - baseGamePrice) < 0.01
      ) || (data.editions || []).find((edition) => edition.priceValue != null);
      setSelectedEditionName(defaultEdition?.name?.replace(/\s*-\s*\$\s*$/, "") || "");

      if (String(data.type || "").toLowerCase() !== "dlc") {
        fetch("/api/game/" + id + "/bundles?cc=" + cc)
          .then((response) => response.ok ? response.json() : null)
          .then((bundleData) => {
            if (!bundleData || !Array.isArray(bundleData.bundles)) return;
            if (requestId !== gameRequestRef.current) return;
            setGame((current) => String(current?.appid) === String(id)
              ? { ...current, bundles: bundleData.bundles, franchise: bundleData.franchise || null }
              : current);
          })
          .catch(() => {});
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
      setRegionalPriceInput(data.price_overview?.final != null ? (data.price_overview.final / 100).toFixed(2) : "");
      setAppid(String(id));
      setInputId(String(id));
      setQuery(data.name);
      setActiveTab("overview");
    } catch (error) {
      if (requestId === gameRequestRef.current) setError(error.message || "Something went wrong.");
    } finally {
      if (requestId === gameRequestRef.current) setLoading(false);
    }
  }

  async function loadMoreDlc() {
    if (!game || loadingMoreDlc || !(game.dlc_has_more ?? ((game.dlc || []).length < game.dlc_total))) return;

    const requestId = gameRequestRef.current;
    const targetAppId = String(game.appid);
    setLoadingMoreDlc(true);
    setError("");

    try {
      const offset = Number.isSafeInteger(Number(game.dlc_next_offset))
        ? Number(game.dlc_next_offset)
        : (game.dlc || []).length;
      const response = await fetch("/api/game/" + targetAppId + "/dlc?cc=" + region + "&offset=" + offset + "&limit=24");
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || data.detail || "Unable to load more DLC.");
      if (requestId !== gameRequestRef.current) return;

      setGame((current) => {
        if (!current || String(current.appid) !== targetAppId) return current;
        const existing = new Set((current.dlc || []).map((item) => String(item.appid)));
        const newItems = (data.items || []).filter((item) => !existing.has(String(item.appid)));
        return {
          ...current,
          dlc: [...(current.dlc || []), ...newItems],
          dlc_total: data.total ?? current.dlc_total,
          dlc_next_offset: data.nextOffset ?? offset + 24,
          dlc_has_more: data.hasMore ?? ((data.nextOffset ?? offset + 24) < (data.total ?? current.dlc_total))
        };
      });
    } catch (error) {
      if (requestId === gameRequestRef.current) setError(error.message || "Could not load more DLC.");
    } finally {
      if (requestId === gameRequestRef.current) setLoadingMoreDlc(false);
    }
  }

  return {
    game, setGame, gameBackground, setGameBackground,
    loading, setLoading, loadingMoreDlc, error, setError,
    regionalPriceInput, setRegionalPriceInput,
    selectedEditionName, setSelectedEditionName,
    purchaseTab, setPurchaseTab,
    loadGame, loadMoreDlc, invalidateGameRequest
  };
}
