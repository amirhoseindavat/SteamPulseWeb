(() => {
  if (window.__steamPulseStoreButtonLoaded) return;
  window.__steamPulseStoreButtonLoaded = true;

  const STEAMPULSE_URL = "http://localhost:5173/#/game/";

  function getAppId() {
    const match = window.location.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }

  function getGameName() {
    const title = document.querySelector("#appHubAppName, .apphub_AppName, .apphub_AppNameTitle");
    return title?.textContent?.trim() || "this game";
  }

  function findPackageList() {
    const candidates = [
      document.querySelector("#game_area_purchase"),
      document.querySelector("#game_area_purchase_section"),
      document.querySelector(".game_area_purchase")
    ].filter(Boolean);

    for (const root of candidates) {
      const firstPackage = root.querySelector(
        "#game_area_purchase_game, #game_area_purchase_dlc, .game_area_purchase_game, .game_area_purchase"
      );
      if (firstPackage) return { root, firstPackage };
      return { root, firstPackage: null };
    }
    return null;
  }

  function addButton() {
    const appId = getAppId();
    if (!appId) return;

    const target = findPackageList();
    if (!target) return;

    const existing = document.querySelector(".steampulse-store-banner");
    if (existing) {
      existing.querySelector(".steampulse-store-main").href = `${STEAMPULSE_URL}${appId}`;
      existing.querySelector(".steampulse-store-open").href = `${STEAMPULSE_URL}${appId}`;
      existing.querySelector(".steampulse-store-label").textContent = `View ${getGameName()} in SteamPulse`;
      if (target.firstPackage && existing.parentElement === target.root &&
          existing.nextElementSibling !== target.firstPackage) {
        target.root.insertBefore(existing, target.firstPackage);
      }
      return;
    }

    const gameUrl = `${STEAMPULSE_URL}${appId}`;
    const banner = document.createElement("div");
    banner.className = "steampulse-store-banner";

    const main = document.createElement("a");
    main.className = "steampulse-store-main";
    main.href = gameUrl;
    main.target = "_blank";
    main.rel = "noopener noreferrer";
    main.innerHTML = `
      <span class="steampulse-store-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="25" height="25" fill="none">
          <path d="M4 17h5l3-8 5 15 3-9 2 2h6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="steampulse-store-label"></span>
    `;
    main.querySelector(".steampulse-store-label").textContent = `View ${getGameName()} in SteamPulse`;

    const open = document.createElement("a");
    open.className = "steampulse-store-open";
    open.href = gameUrl;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "Open";
    open.setAttribute("aria-label", "Open this game in SteamPulse");

    banner.append(main, open);

    if (!document.querySelector("#steampulse-store-button-style")) {
      const style = document.createElement("style");
      style.id = "steampulse-store-button-style";
      style.textContent = `
        .steampulse-store-banner {
          display: flex;
          align-items: stretch;
          gap: 9px;
          width: 100%;
          box-sizing: border-box;
          margin: 0 0 14px;
          padding: 9px;
          border: 1px solid rgba(145, 105, 255, .38);
          border-radius: 9px;
          background: linear-gradient(110deg, rgba(83, 42, 164, .22), rgba(27, 22, 42, .9));
        }
        .steampulse-store-main {
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
          gap: 11px;
          padding: 11px 13px;
          border-radius: 6px;
          color: #fff !important;
          font: 600 14px/1.35 Arial, sans-serif;
          text-decoration: none !important;
          transition: background .15s ease;
        }
        .steampulse-store-main:hover {
          background: rgba(128, 83, 255, .2);
          color: #fff !important;
        }
        .steampulse-store-icon {
          display: grid;
          place-items: center;
          flex: 0 0 36px;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: linear-gradient(135deg, #8957ff, #5726c7);
          color: #fff;
        }
        .steampulse-store-label {
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .steampulse-store-open {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 74px;
          padding: 0 18px;
          border: 1px solid rgba(169, 140, 255, .55);
          border-radius: 6px;
          background: rgba(112, 68, 219, .3);
          color: #fff !important;
          font: 600 13px Arial, sans-serif;
          text-decoration: none !important;
          transition: background .15s ease;
        }
        .steampulse-store-open:hover {
          background: rgba(128, 83, 255, .55);
          color: #fff !important;
        }
        @media (max-width: 480px) {
          .steampulse-store-banner { gap: 5px; padding: 6px; }
          .steampulse-store-main { gap: 8px; padding: 9px 6px; font-size: 12px; }
          .steampulse-store-icon { flex-basis: 30px; width: 30px; height: 30px; }
          .steampulse-store-open { min-width: 54px; padding: 0 10px; }
        }
      `;
      document.head.appendChild(style);
    }

    if (target.firstPackage) {
      target.root.insertBefore(banner, target.firstPackage);
    } else {
      target.root.prepend(banner);
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