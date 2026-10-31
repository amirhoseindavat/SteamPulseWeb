(() => {
  if (window.__steamPulseBridgeLoaded) return;
  window.__steamPulseBridgeLoaded = true;

  const allowedHosts = new Set([
    "amirhoseindavat.github.io",
    "localhost",
    "127.0.0.1"
  ]);

  if (!allowedHosts.has(window.location.hostname)) return;

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.source !== "STEAMPULSE_PAGE" || event.data?.type !== "GET_ACCOUNT_SNAPSHOT") return;

    chrome.runtime.sendMessage({ type: "STEAMPULSE_GET_SNAPSHOT" }, (response) => {
      const snapshot = response?.snapshot || null;
      window.postMessage({
        source: "STEAMPULSE_CONNECT",
        type: "ACCOUNT_SNAPSHOT",
        snapshot
      }, window.location.origin);
    });
  });
})();