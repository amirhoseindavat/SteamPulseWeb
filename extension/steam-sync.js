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

  function firstNumber(value) {
    const text = String(value || "");
    let digits = "";
    let started = false;

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 48 && code <= 57) {
        digits += text[i];
        started = true;
      } else if (started) {
        break;
      }
    }

    const number = Number(digits);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }

  function collectCartBundleIds(data) {
    const bundleIds = new Set(
      (Array.isArray(data.rgBundlesInCart) ? data.rgBundlesInCart : [])
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    );

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const isCartPage = pathParts.length === 1 && pathParts[0].toLowerCase() === "cart";

    if (isCartPage) {
      document.querySelectorAll("[data-ds-bundleid], [data-bundleid]").forEach((element) => {
        const raw = element.getAttribute("data-ds-bundleid") || element.getAttribute("data-bundleid") || "";
        const id = firstNumber(raw);
        if (id) bundleIds.add(id);
      });

      document.querySelectorAll(
        '.cart_item a[href], .cart_item_wrapper a[href], [data-cart-item] a[href]'
      ).forEach((element) => {
        try {
          const url = new URL(element.getAttribute("href"), window.location.origin);
          const parts = url.pathname.split("/").filter(Boolean);
          const bundleIndex = parts.findIndex((part) => part.toLowerCase() === "bundle");
          if (bundleIndex !== -1) {
            const id = firstNumber(parts[bundleIndex + 1]);
            if (id) bundleIds.add(id);
          }
        } catch (_) {
          // Ignore malformed cart links.
        }
      });
    }

    return Array.from(bundleIds);
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
      data.rgBundlesInCart = collectCartBundleIds(data);

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

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "STEAMPULSE_REFRESH_STEAM_DATA") {
      syncSteamAccount(true);
    }
  });
})();
