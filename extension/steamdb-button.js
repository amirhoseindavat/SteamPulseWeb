(() => {
  if (window.__steamPulseSteamDbButtonLoaded) return;
  window.__steamPulseSteamDbButtonLoaded = true;

  const STEAMPULSE_URL = "http://localhost:5173/#/game/";
  const STEAMPULSE_LOGO = "https://steampulse.ir/favicon.png";
  const BUTTON_CLASS = "steampulse-steamdb-store-link";

  function getAppId() {
    const match = window.location.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }

  function getGameName() {
    return document.querySelector("h1")?.textContent?.trim()
      || document.title.replace(/\s*[·|].*$/, "").trim()
      || "this game";
  }

  function addButton() {
    const appId = getAppId();
    if (!appId) return;

    // SteamDB renders the Store / Hub / PCGW links together near the app header.
    const storeLink = Array.from(document.querySelectorAll('a[href*="store.steampowered.com/app/"]'))
      .find((link) => link.closest("header") === null || link.closest("main"));
    if (!storeLink || !storeLink.parentElement) return;

    let button = document.querySelector("." + BUTTON_CLASS);
    if (!button) {
      // Reuse the Store link's classes so the new item fits SteamDB's native link row.
      button = storeLink.cloneNode(false);
      button.classList.add(BUTTON_CLASS);
      button.href = STEAMPULSE_URL + appId;
      button.target = "_blank";
      button.rel = "noopener noreferrer";
      button.title = "Open this game in SteamPulse";
      button.setAttribute("aria-label", "Open this game in SteamPulse");

      const logo = document.createElement("img");
      logo.src = STEAMPULSE_LOGO;
      logo.alt = "";
      logo.width = 16;
      logo.height = 16;
      logo.style.cssText = "width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:5px;";

      const label = document.createElement("span");
      label.textContent = "SteamPulse";
      label.style.cssText = "font-weight:700;";

      button.append(logo, label);
      button.style.cssText += ";display:inline-flex;align-items:center;white-space:nowrap;";
    }

    const expectedUrl = STEAMPULSE_URL + appId;
    if (button.href !== expectedUrl) button.href = expectedUrl;
    button.title = "Open " + getGameName() + " in SteamPulse";

    // Keep it immediately before Store, even if SteamDB rebuilds its link row.
    if (button.parentElement !== storeLink.parentElement || button.nextElementSibling !== storeLink) {
      storeLink.parentElement.insertBefore(button, storeLink);
    }
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