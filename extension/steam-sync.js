(() => {
  if (window.__steamPulseSyncLoaded) return;
  window.__steamPulseSyncLoaded = true;

  const USERDATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";
  const ACCOUNT_URL = "https://store.steampowered.com/account/";
  const SYNC_INTERVAL_MS = 60_000;
  let syncing = false;
  let lastSyncAt = 0;
  let contextInvalidated = false;

  function hasExtensionContext() {
    try {
      return Boolean(chrome && chrome.runtime && chrome.runtime.id);
    } catch (_) {
      contextInvalidated = true;
      return false;
    }
  }

  function sendSnapshot(snapshot) {
    if (!hasExtensionContext()) return;

    try {
      chrome.runtime.sendMessage(
        { type: "STEAMPULSE_SAVE_SNAPSHOT", snapshot },
        () => {
          try {
            void chrome.runtime.lastError;
          } catch (_) {
            contextInvalidated = true;
          }
        }
      );
    } catch (error) {
      if (/context invalidated/i.test(error && error.message ? error.message : String(error))) {
        contextInvalidated = true;
        return;
      }
      throw error;
    }
  }

  async function syncSteamAccount(force = false) {
    if (contextInvalidated || !hasExtensionContext()) return;
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
      if (contextInvalidated || !hasExtensionContext()) return;

      const accountPath = new URL(accountResponse.url || ACCOUNT_URL).pathname;
      const loginStatus = /(^|\/)login\/?$/i.test(accountPath) ? "disconnected" : "connected";

      const snapshot = {
        source: "steam-dynamicstore-userdata",
        loginStatus,
        updatedAt: new Date().toISOString(),
        data
      };

      sendSnapshot(snapshot);
      if (!contextInvalidated) {
        document.documentElement.dataset.steampulseConnected = loginStatus;
      }
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      if (/context invalidated/i.test(message)) {
        contextInvalidated = true;
        return;
      }
      document.documentElement.dataset.steampulseConnected = "error";
      console.warn("[SteamPulse Connect]", message);
    } finally {
      syncing = false;
    }
  }

  syncSteamAccount(true);
  window.setInterval(() => {
    if (!contextInvalidated) syncSteamAccount(false);
  }, SYNC_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (!contextInvalidated && document.visibilityState === "visible") {
      syncSteamAccount(true);
    }
  });

  if (hasExtensionContext()) {
    chrome.runtime.onMessage.addListener((message) => {
      if (!contextInvalidated && message && message.type === "STEAMPULSE_REFRESH_STEAM_DATA") {
        syncSteamAccount(true);
      }
    });
  }
})();
