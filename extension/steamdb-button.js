(() => {
  if (window.__steamPulseSteamDbButtonLoaded) return;
  window.__steamPulseSteamDbButtonLoaded = true;

  const APP_URL = "https://steampulseweb.pages.dev/#/game/";
  const LOGO_URL = "https://steampulseweb.pages.dev/favicon.png";
  const BUTTON_CLASS = "steampulse-steamdb-link";

  function getAppId() {
    const match = location.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
    return match ? match[1] : "";
  }

  function findStoreLink(appId) {
    const links = Array.from(document.querySelectorAll('a[href*="store.steampowered.com/app/"]'));
    return links.find((link) => {
      try {
        const url = new URL(link.href);
        return url.pathname.startsWith("/app/" + appId);
      } catch (_) {
        return false;
      }
    }) || null;
  }

  function createButton(appId) {
    const link = document.createElement("a");
    link.className = BUTTON_CLASS + " btn btn-default";
    link.href = APP_URL + appId;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Open this game in SteamPulse";
    link.setAttribute("aria-label", "Open this game in SteamPulse");

    const logo = document.createElement("img");
    logo.src = LOGO_URL;
    logo.alt = "";
    logo.width = 16;
    logo.height = 16;

    const label = document.createElement("span");
    label.textContent = "SteamPulse";

    link.append(logo, label);
    link.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "gap:6px",
      "white-space:nowrap",
      "vertical-align:middle",
      "margin-right:6px",
      "text-decoration:none"
    ].join(";");

    logo.style.cssText = "width:16px;height:16px;object-fit:contain;display:block";
    label.style.cssText = "font-weight:700";
    return link;
  }

  function addButton() {
    const appId = getAppId();
    if (!appId) return;

    const storeLink = findStoreLink(appId);
    if (!storeLink || !storeLink.parentElement) return;

    let button = document.querySelector("." + BUTTON_CLASS);
    if (!button) button = createButton(appId);

    const targetUrl = APP_URL + appId;
    if (button.href !== targetUrl) button.href = targetUrl;

    // Insert next to the existing Steam Store link, without cloning SteamDB nodes.
    if (button.parentElement !== storeLink.parentElement || button.nextElementSibling !== storeLink) {
      storeLink.parentElement.insertBefore(button, storeLink);
    }
  }

  let scheduled = false;
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      try { addButton(); } catch (error) {
        console.warn("[SteamPulse] SteamDB button could not be added:", error);
      }
    }, 120);
  }

  scheduleUpdate();

  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let previousUrl = location.href;
  window.setInterval(() => {
    if (location.href !== previousUrl) {
      previousUrl = location.href;
      scheduleUpdate();
    }
  }, 700);
})();