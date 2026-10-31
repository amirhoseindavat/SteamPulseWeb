(() => {
  if (window.__steamPulseSyncLoaded) return;
  window.__steamPulseSyncLoaded = true;

  const USERDATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";
  const ACCOUNT_URL = "https://store.steampowered.com/account/";
  const SYNC_INTERVAL_MS = 60_000;
  let syncing = false;
  let lastSyncAt = 0;

  function sendSnapshot(snapshot) {
    chrome.runtime.sendMessage(
      { type: "STEAMPULSE_SAVE_SNAPSHOT", snapshot },
      () => void chrome.runtime.lastError
    );
  }

  async function syncSteamAccount(force = false) {
    if (syncing || document.visibilityState === "hidden") return;
    if (!force && Date.now() - lastSyncAt < 15_000) return;

    syncing = true;
    lastSyncAt = Date.now();

    try {
      const [userdataResponse, accountResponse] = await Promise.all([
        fetch(USERDATA_URL, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" }
        }),
        fetch(ACCOUNT_URL, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          redirect: "follow"
        })
      ]);

      if (!userdataResponse.ok) {
        throw new Error("Steam account data request failed (" + userdataResponse.status + ").");
      }

      const data = await userdataResponse.json();
      const accountPath = new URL(accountResponse.url || ACCOUNT_URL).pathname;
      const loginStatus = /(^|\/)login\/?$/i.test(accountPath) ? "disconnected" : "connected";

      const snapshot = {
        source: "steam-dynamicstore-userdata",
        loginStatus,
        updatedAt: new Date().toISOString(),
        data
      };

      sendSnapshot(snapshot);
      document.documentElement.dataset.steampulseConnected = loginStatus;
    } catch (error) {
      document.documentElement.dataset.steampulseConnected = "error";
      console.warn("[SteamPulse Connect]", error.message || error);
    } finally {
      syncing = false;
    }
  }

  syncSteamAccount(true);
  window.setInterval(() => syncSteamAccount(false), SYNC_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncSteamAccount(true);
  });

  // Allows a manual refresh from a future extension popup without exposing account data to page scripts.
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "STEAMPULSE_REFRESH_STEAM_DATA") syncSteamAccount(true);
  });
})();