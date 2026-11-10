import { useEffect, useState } from "react";
import { getCartDetails } from "../services/steamPulseApi";

export function useSteamAccount(region) {
  const [steamAccountSnapshot, setSteamAccountSnapshot] = useState(null);
  const [steamCartDetails, setSteamCartDetails] = useState([]);
  const [steamCartDetailsLoading, setSteamCartDetailsLoading] = useState(false);
  const [steamCartDetailsError, setSteamCartDetailsError] = useState("");

  useEffect(() => {
    const receiveSteamAccount = (event) => {
      if (event.source !== window || event.data?.source !== "STEAMPULSE_CONNECT" || event.data?.type !== "ACCOUNT_SNAPSHOT") return;
      setSteamAccountSnapshot(event.data.snapshot || null);
    };
    const requestSteamAccount = (refresh = false) => {
      window.postMessage({ source: "STEAMPULSE_PAGE", type: refresh ? "REFRESH_ACCOUNT_SNAPSHOT" : "GET_ACCOUNT_SNAPSHOT" }, window.location.origin);
    };
    window.addEventListener("message", receiveSteamAccount);
    requestSteamAccount();
    requestSteamAccount(true);
    const syncTimer = window.setInterval(() => requestSteamAccount(true), 60000);
    return () => {
      window.removeEventListener("message", receiveSteamAccount);
      window.clearInterval(syncTimer);
    };
  }, []);

  const steamAccountData = steamAccountSnapshot?.data || null;
  const steamAccountConnected = steamAccountSnapshot?.loginStatus === "connected";
  const steamWishlist = new Set((steamAccountData?.rgWishlist || []).map(Number));
  const steamOwnedApps = new Set((steamAccountData?.rgOwnedApps || []).map(Number));
  const steamOwnedPackages = new Set((steamAccountData?.rgOwnedPackages || []).map(Number));
  const steamCartApps = (steamAccountData?.rgAppsInCart || []).map(Number);

  useEffect(() => {
    const controller = new AbortController();
    const appIds = [...new Set(steamCartApps.filter((id) => Number.isSafeInteger(id) && id > 0))].join(",");
    if (!steamAccountConnected || !appIds) {
      setSteamCartDetails([]);
      setSteamCartDetailsError("");
      setSteamCartDetailsLoading(false);
      return () => controller.abort();
    }

    setSteamCartDetailsLoading(true);
    setSteamCartDetailsError("");
    getCartDetails(region, appIds, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSteamCartDetails(data.items || []);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSteamCartDetailsError(error.message || "Cart details are temporarily unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSteamCartDetailsLoading(false);
      });

    return () => controller.abort();
  }, [steamAccountConnected, steamCartApps.join(","), region]);

  return {
    steamAccountSnapshot,
    steamAccountData,
    steamAccountConnected,
    steamWishlist,
    steamOwnedApps,
    steamOwnedPackages,
    steamCartApps,
    steamCartDetails,
    steamCartDetailsLoading,
    steamCartDetailsError
  };
}
