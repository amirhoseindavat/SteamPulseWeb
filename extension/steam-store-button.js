(() => {
  if (window.__steamPulseStoreButtonLoaded) return;
  window.__steamPulseStoreButtonLoaded = true;

  const STEAMPULSE_URL = "http://localhost:5173/#/game/";
  const STEAMPULSE_LOGO = "https://steampulse.ir/favicon.png";

  function getAppId() {
    const match = window.location.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }

  function getGameName() {
    const title = document.querySelector("#appHubAppName, .apphub_AppName, .apphub_AppNameTitle");
    return title?.textContent?.trim() || document.querySelector("#game_area_purchase h2.title")?.textContent?.replace(/^Buy\s+/i, "").trim() || "this game";
  }

  function findPackageAnchor() {
    const purchaseArea = document.querySelector("#game_area_purchase");
    if (!purchaseArea) return null;

    // insertBefore only accepts a direct child of purchaseArea.
    // Steam sometimes nests/rebuilds package elements, so resolve the
    // direct child that contains the first package instead of returning
    // a potentially nested descendant.
    const packageSelector = ".game_area_purchase_game_wrapper, .dynamic_bundle_description";
    const firstPackage = Array.from(purchaseArea.children).find((child) =>
      child.matches(packageSelector) || child.querySelector(packageSelector)
    );

    return { purchaseArea, firstPackage: firstPackage || null };
  }

  function addButton() {
    const appId = getAppId();
    if (!appId) return;

    const target = findPackageAnchor();
    if (!target) return;

    const gameUrl = STEAMPULSE_URL + appId;
    let banner = document.querySelector(".steampulse-store-banner");

    if (!banner) {
      banner = document.createElement("div");
      banner.className = "steampulse-store-banner";

      const main = document.createElement("a");
      main.className = "steampulse-store-main";
      main.target = "_blank";
      main.rel = "noopener noreferrer";
      main.innerHTML = `
        <span class="steampulse-store-logo-wrap" aria-hidden="true">
          <img class="steampulse-store-logo" src="${STEAMPULSE_LOGO}" alt="">
        </span>
        <span class="steampulse-store-copy">
          <span class="steampulse-store-eyebrow">STEAMPULSE</span>
          <span class="steampulse-store-label"></span>
          <span class="steampulse-store-description">Explore this game on SteamPulse</span>
        </span>
        <span class="steampulse-store-arrow" aria-hidden="true">↗</span>
      `;

      banner.appendChild(main);

      if (!document.querySelector("#steampulse-store-button-style")) {
        const style = document.createElement("style");
        style.id = "steampulse-store-button-style";
        style.textContent = `
          .steampulse-store-banner {
            position: relative !important;
            display: block !important;
            width: 100% !important;
            box-sizing: border-box !important;
            margin: 0 0 16px !important;
            padding: 1px !important;
            overflow: hidden !important;
            border: 1px solid rgba(145, 105, 255, .42) !important;
            border-radius: 12px !important;
            background: linear-gradient(115deg, rgba(101, 31, 255, .38), rgba(35, 25, 57, .92) 48%, rgba(20, 25, 37, .96)) !important;
            box-shadow: 0 5px 18px rgba(0, 0, 0, .2), inset 0 1px 0 rgba(255, 255, 255, .06) !important;
          }
          .steampulse-store-banner::before {
            content: "" !important;
            position: absolute !important;
            inset: 0 auto 0 0 !important;
            width: 3px !important;
            background: linear-gradient(180deg, #b99aff, #651fff) !important;
            pointer-events: none !important;
          }
          .steampulse-store-main {
            position: relative !important;
            display: flex !important;
            align-items: center !important;
            gap: 13px !important;
            min-width: 0 !important;
            padding: 13px 15px 13px 17px !important;
            color: #fff !important;
            text-decoration: none !important;
            transition: background .18s ease, transform .18s ease !important;
          }
          .steampulse-store-main:hover {
            color: #fff !important;
            text-decoration: none !important;
            background: rgba(132, 87, 255, .13) !important;
          }
          .steampulse-store-logo-wrap {
            display: grid !important;
            place-items: center !important;
            flex: 0 0 42px !important;
            width: 42px !important;
            height: 42px !important;
            box-sizing: border-box !important;
            border: 1px solid rgba(255, 255, 255, .18) !important;
            border-radius: 10px !important;
            background: linear-gradient(145deg, rgba(101, 31, 255, .95), rgba(65, 29, 145, .95)) !important;
            box-shadow: 0 3px 10px rgba(0, 0, 0, .22), inset 0 1px 0 rgba(255, 255, 255, .2) !important;
          }
          .steampulse-store-logo {
            display: block !important;
            width: 27px !important;
            height: 27px !important;
            object-fit: contain !important;
            border: 0 !important;
            border-radius: 0 !important;
          }
          .steampulse-store-copy {
            display: flex !important;
            flex: 1 1 auto !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 2px !important;
            min-width: 0 !important;
          }
          .steampulse-store-eyebrow {
            color: #b99aff !important;
            font: 800 9px/1.2 Arial, sans-serif !important;
            letter-spacing: 1.5px !important;
          }
          .steampulse-store-label {
            display: block !important;
            max-width: 100% !important;
            overflow: hidden !important;
            color: #fff !important;
            font: 700 14px/1.4 Arial, sans-serif !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          .steampulse-store-description {
            display: block !important;
            color: #a8a5b5 !important;
            font: 400 11px/1.35 Arial, sans-serif !important;
          }
          .steampulse-store-arrow {
            display: grid !important;
            place-items: center !important;
            flex: 0 0 30px !important;
            width: 30px !important;
            height: 30px !important;
            border: 1px solid rgba(185, 154, 255, .28) !important;
            border-radius: 8px !important;
            background: rgba(101, 31, 255, .2) !important;
            color: #d9caff !important;
            font: 700 17px/1 Arial, sans-serif !important;
            transition: transform .18s ease, background .18s ease !important;
          }
          .steampulse-store-main:hover .steampulse-store-arrow {
            transform: translate(2px, -2px) !important;
            background: rgba(101, 31, 255, .42) !important;
          }
          @media (max-width: 480px) {
            .steampulse-store-main { gap: 10px !important; padding: 11px 10px 11px 13px !important; }
            .steampulse-store-logo-wrap { flex-basis: 36px !important; width: 36px !important; height: 36px !important; }
            .steampulse-store-logo { width: 23px !important; height: 23px !important; }
            .steampulse-store-label { font-size: 12px !important; }
            .steampulse-store-description { font-size: 10px !important; }
            .steampulse-store-arrow { flex-basis: 27px !important; width: 27px !important; height: 27px !important; }
          }
        `;
        document.head.appendChild(style);
      }
    }

    const mainLink = banner.querySelector(".steampulse-store-main");
    const label = banner.querySelector(".steampulse-store-label");
    const logo = banner.querySelector(".steampulse-store-logo");
    const gameLabel = "View " + getGameName() + " in SteamPulse";

    // Avoid generating mutations when the observer calls addButton again.
    if (mainLink.href !== gameUrl) mainLink.href = gameUrl;
    if (label.textContent !== gameLabel) label.textContent = gameLabel;
    if (logo.src !== STEAMPULSE_LOGO) logo.src = STEAMPULSE_LOGO;

    if (target.firstPackage) {
      // Steam can replace purchase nodes while the page is being updated.
      // Re-check the reference immediately before insertBefore so a stale
      // node can never trigger NotFoundError.
      if (target.firstPackage.parentNode !== target.purchaseArea) return;

      if (banner.parentElement !== target.purchaseArea || banner.nextElementSibling !== target.firstPackage) {
        target.purchaseArea.insertBefore(banner, target.firstPackage);
      }
    } else if (banner.parentElement !== target.purchaseArea) {
      target.purchaseArea.appendChild(banner);
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
