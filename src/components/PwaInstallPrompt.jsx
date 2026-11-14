import { useEffect, useState } from "react";
import { Download, X, Share, Smartphone } from "lucide-react";

const DISMISS_KEY = "steampulse-pwa-dismissed-at";
const DISMISS_DAYS = 7;

function wasRecentlyDismissed() {
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function isIosSafari() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    /safari/i.test(navigator.userAgent) &&
    !/crios|fxios|edgios|opios/i.test(navigator.userAgent);
}

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return undefined;

    let showTimer;
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      showTimer = window.setTimeout(() => setShowPrompt(true), 2500);
    };
    const handleAppInstalled = () => {
      setShowPrompt(false);
      setInstallPrompt(null);
      setIosHelp(false);
      try { localStorage.removeItem(DISMISS_KEY); } catch { /* Ignore storage errors. */ }
    };

    if (isIosSafari()) {
      showTimer = window.setTimeout(() => {
        if (!isStandalone() && !wasRecentlyDismissed()) {
          setIosHelp(true);
          setShowPrompt(true);
        }
      }, 8000);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showPrompt) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") dismissPrompt();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPrompt]);

  function dismissPrompt() {
    setShowPrompt(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* Ignore storage errors. */ }
  }

  async function installApp() {
    if (!installPrompt) return;
    const promptEvent = installPrompt;
    setInstallPrompt(null);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setShowPrompt(false);
    if (choice?.outcome === "dismissed") {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* Ignore storage errors. */ }
    }
  }

  if (!showPrompt) return null;

  return (
    <div className="pwa-prompt-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) dismissPrompt();
    }}>
      <section className="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
        <button className="pwa-prompt-close" type="button" onClick={dismissPrompt} aria-label="Close install prompt">
          <X size={18} />
        </button>
        <div className="pwa-install-icon"><Download size={25} /></div>
        <span className="pwa-install-eyebrow">YOUR STEAMPULSE, ONE TAP AWAY</span>
        <h2 id="pwa-install-title">Install SteamPulse</h2>
        <p className="pwa-install-description">
          Add SteamPulse to your device for a clean, app-like experience right from your home screen.
        </p>
        {iosHelp ? (
          <div className="pwa-ios-instructions">
            <div><Share size={17} /> Tap <strong>Share</strong> in Safari</div>
            <div><Smartphone size={17} /> Choose <strong>Add to Home Screen</strong></div>
          </div>
        ) : (
          <button className="pwa-install-button" type="button" onClick={installApp}>
            <Download size={17} /> Install SteamPulse
          </button>
        )}
        <button className="pwa-install-later" type="button" onClick={dismissPrompt}>Maybe later</button>
      </section>
    </div>
  );
}
