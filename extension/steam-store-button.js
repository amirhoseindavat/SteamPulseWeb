(() => {
  if (window.__steamPulseStoreButtonLoaded) return;
  window.__steamPulseStoreButtonLoaded = true;

  const STEAMPULSE_URL = "https://amirhoseindavat.github.io/SteamPulseWeb/";

  function getAppId() {
    const match = window.location.pathname.match(/^\\/app\\/(\\d+)(?:\\/|$)/);
    return match ? match[1] : null;
  }

  function addButton() {
    const appId = getAppId();
    if (!appId) return;

    const title = document.querySelector("#appHubAppName, .apphub_AppName");
    if (!title) return;

    const host = title.closest(".apphub_HeaderStandardTop") || title.parentElement;
    if (!host || host.querySelector(".steampulse-store-button")) return;

    const link = document.createElement("a");
    link.className = "steampulse-store-button";
    link.href = `${STEAMPULSE_URL}#/game/${appId}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "↗ View in SteamPulse";
    link.setAttribute("aria-label", "View this game in SteamPulse");

    if (!document.querySelector("#steampulse-store-button-style")) {
      const style = document.createElement("style");
      style.id = "steampulse-store-button-style";
      style.textContent = `
        .steampulse-store-button {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          margin-top: 12px;
          padding: 8px 13px;
          border: 1px solid rgba(161, 125, 255, .55);
          border-radius: 8px;
          background: linear-gradient(135deg, #7137ed, #4b19bd);
          color: #fff !important;
          font: 600 13px/1.2 Arial, sans-serif;
          text-decoration: none !important;
          box-shadow: 0 3px 12px rgba(75, 25, 189, .25);
          transition: transform .15s ease, filter .15s ease;
        }
        .steampulse-store-button:hover {
          color: #fff !important;
          filter: brightness(1.12);
          transform: translateY(-1px);
        }
      `;
      document.head.appendChild(style);
    }

    host.appendChild(link);
  }

  addButton();
  const observer = new MutationObserver(addButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let lastUrl = location.href;
  window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      addButton();
    }
  }, 800);
})();