const SNAPSHOT_KEY = "steamPulseAccountSnapshot";

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

  if (message?.type === "STEAMPULSE_CLEAR_SNAPSHOT") {
    chrome.storage.local.remove(SNAPSHOT_KEY)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});