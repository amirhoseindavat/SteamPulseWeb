const SNAPSHOT_KEY = "steamPulseAccountSnapshot";\nconst USERDATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";

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

  if (message?.type === "STEAMPULSE_REFRESH_SNAPSHOT") {\n    fetch(USERDATA_URL + "?v=" + Date.now(), { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })\n      .then(async (response) => { if (!response.ok) throw new Error("Steam account request failed (" + response.status + ")."); const data = await response.json(); const snapshot = { source: "steam-dynamicstore-userdata", loginStatus: "connected", updatedAt: new Date().toISOString(), data }; await chrome.storage.local.set({ [SNAPSHOT_KEY]: snapshot }); sendResponse({ ok: true }); })\n      .catch((error) => sendResponse({ ok: false, error: error.message }));\n    return true;\n  }\n\n  if (message?.type === "STEAMPULSE_CLEAR_SNAPSHOT") {
    chrome.storage.local.remove(SNAPSHOT_KEY)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});