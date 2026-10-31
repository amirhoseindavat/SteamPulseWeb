const SNAPSHOT_KEY = "steamPulseAccountSnapshot";
const USERDATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "STEAMPULSE_SAVE_SNAPSHOT" && message.snapshot) {
    chrome.storage.local.set({ [SNAPSHOT_KEY]: message.snapshot })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "STEAMPULSE_GET_SNAPSHOT") {
    chrome.storage.local.get(SNAPSHOT_KEY)
      .then((result) => sendResponse({ snapshot: result[SNAPSHOT_KEY] || null }))
      .catch((error) => sendResponse({ snapshot: null, error: error.message }));
    return true;
  }

  if (message?.type === "STEAMPULSE_REFRESH_SNAPSHOT") {
    fetch(USERDATA_URL + "?v=" + Date.now(), {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" }
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Steam account request failed (" + response.status + ").");
        const data = await response.json();
        const existing = await chrome.storage.local.get(SNAPSHOT_KEY);
        const previousData = existing[SNAPSHOT_KEY]?.data || {};
        // Preserve bundle IDs discovered from the rendered Steam cart page.
        if (!Array.isArray(data.rgBundlesInCart) || data.rgBundlesInCart.length === 0) {
          data.rgBundlesInCart = Array.isArray(previousData.rgBundlesInCart)
            ? previousData.rgBundlesInCart
            : [];
        }
        const snapshot = {
          source: "steam-dynamicstore-userdata",
          loginStatus: "connected",
          updatedAt: new Date().toISOString(),
          data
        };
        await chrome.storage.local.set({ [SNAPSHOT_KEY]: snapshot });
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "STEAMPULSE_CLEAR_SNAPSHOT") {
    chrome.storage.local.remove(SNAPSHOT_KEY)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
