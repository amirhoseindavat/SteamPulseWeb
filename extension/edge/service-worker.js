var SNAPSHOT_KEY = "steamPulseAccountSnapshot";
var USERDATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.type) return false;

  if (message.type === "STEAMPULSE_SAVE_SNAPSHOT" && message.snapshot) {
    chrome.storage.local.set({ steamPulseAccountSnapshot: message.snapshot }, function () {
      if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      else sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "STEAMPULSE_GET_SNAPSHOT") {
    chrome.storage.local.get(SNAPSHOT_KEY, function (result) {
      if (chrome.runtime.lastError) sendResponse({ snapshot: null, error: chrome.runtime.lastError.message });
      else sendResponse({ snapshot: result[SNAPSHOT_KEY] || null });
    });
    return true;
  }

  if (message.type === "STEAMPULSE_REFRESH_SNAPSHOT") {
    fetch(USERDATA_URL + "?v=" + Date.now(), {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" }
    }).then(function (response) {
      if (!response.ok) throw new Error("Steam account request failed (" + response.status + ").");
      return response.json();
    }).then(function (data) {
      chrome.storage.local.get(SNAPSHOT_KEY, function (result) {
        var snapshot = {
          source: "steam-dynamicstore-userdata",
          loginStatus: "connected",
          updatedAt: new Date().toISOString(),
          data: data
        };
        chrome.storage.local.set({ steamPulseAccountSnapshot: snapshot }, function () {
          if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          else sendResponse({ ok: true });
        });
      });
    }).catch(function (error) {
      sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
    });
    return true;
  }

  if (message.type === "STEAMPULSE_CLEAR_SNAPSHOT") {
    chrome.storage.local.remove(SNAPSHOT_KEY, function () {
      if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      else sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});
