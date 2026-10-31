import { useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import {
  Search, Gamepad2, Activity, CalendarDays, ExternalLink, Monitor, Apple, Settings, Save, Library, ShieldCheck, UserRound, Trophy, Clock3, UsersRound, Calculator, Share2,
  Star, Users, Tag, ChevronRight, LoaderCircle, X, RefreshCw, Globe2, Gift,
  Sparkles, Image as ImageIcon, Info, CheckCircle2, AlertTriangle, CircleHelp, CircleX, Sun, Moon
} from "lucide-react";

const REGIONS = [
  { code: "US", label: "United States", currency: "USD", usdRate: 1 },
  { code: "GB", label: "United Kingdom", currency: "GBP", usdRate: 0.79 },
  { code: "DE", label: "Germany", currency: "EUR", usdRate: 0.92 },
  { code: "TR", label: "Türkiye", currency: "USD", usdRate: 1 },
  { code: "AR", label: "Argentina", currency: "USD", usdRate: 1 },
  { code: "PL", label: "Poland", currency: "PLN", usdRate: 3.7 },
  { code: "UA", label: "Ukraine", currency: "UAH", usdRate: 41.5 },
  { code: "IN", label: "India", currency: "INR", usdRate: 88 },
  { code: "BR", label: "Brazil", currency: "BRL", usdRate: 5.4 }
];

function money(price) {
  if (!price) return "Not available";
  if (price.final_formatted) return price.final_formatted;
  if (Number.isFinite(price.final) && price.currency) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency }).format(price.final / 100);
  }
  return "Not available";
}
function formatNumber(value) {
  return value == null ? "—" : new Intl.NumberFormat("en-US").format(value);
}

function KeyRoundIcon() { return <Tag size={20} />; }
function TicketIcon() { return <Gift size={20} />; }

function SteamDeckMark({ size = 18 }) {
  return <svg className="steam-deck-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.777 4.302a5.698 5.698 0 1 1 0 11.396v3.19a8.889 8.889 0 1 0 0-17.777v3.191Zm0 9.587a3.889 3.889 0 1 0 0-7.778 3.889 3.889 0 0 0 0 7.778Z" /></svg>;
}

function DeckCompatibilityIcon({ status, size = 18 }) {
  const icons = {
    verified: "https://cdn.steamstatic.com/steamcommunity/public/images/steamworks_docs/english/verified_18.png",
    playable: "https://cdn.steamstatic.com/steamcommunity/public/images/steamworks_docs/english/playable_18.png",
    unsupported: "https://cdn.steamstatic.com/steamcommunity/public/images/steamworks_docs/english/unsupported_18.png",
    unknown: "https://cdn.steamstatic.com/steamcommunity/public/images/steamworks_docs/english/unknown_18.png"
  };
  return <img className="steam-deck-rating-icon" src={icons[status] || icons.unknown} width={size} height={size} alt="" />;
}

function Strip({ label, value, icon: Icon }) {
  return <div className="strip-item"><span className="strip-icon"><Icon size={16} /></span><span><small>{label}</small><strong>{value || "—"}</strong></span></div>;
}

export default function App() {
  const [region, setRegion] = useState(() => localStorage.getItem("steampulse-region") || "US");
  const [steamProfile, setSteamProfile] = useState(() => localStorage.getItem("steampulse-profile") || "");
  const [steamProfileDraft, setSteamProfileDraft] = useState(() => localStorage.getItem("steampulse-profile") || "");
  const [steamApiKey, setSteamApiKey] = useState(() => localStorage.getItem("steampulse-api-key") || "");
  const [steamApiKeyDraft, setSteamApiKeyDraft] = useState(() => localStorage.getItem("steampulse-api-key") || "");
  const [ownership, setOwnership] = useState(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState("");
  const [steamProfileData, setSteamProfileData] = useState(null);
  const [steamProfileLoading, setSteamProfileLoading] = useState(false);
  const [steamProfileError, setSteamProfileError] = useState("");
  const [currentPage, setCurrentPage] = useState(() => { const match = window.location.hash.match(/^#\/game\/(\d+)/); return match ? "game" : (window.location.hash.match(/^#\/(home|games|trending|market|calculator|settings|profile)$/)?.[1] || "home"); });
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("steampulse-theme") || "dark");
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [appid, setAppid] = useState("");
  const [inputId, setInputId] = useState("");
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMoreDlc, setLoadingMoreDlc] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [regionalPriceInput, setRegionalPriceInput] = useState("");
  const [selectedEditionName, setSelectedEditionName] = useState("");
  const [purchaseTab, setPurchaseTab] = useState("editions");
  const [shareStatus, setShareStatus] = useState("");
  const shareCardRef = useRef(null);
  const [discovery, setDiscovery] = useState({ newReleases: [], upcoming: [], topSellers: [] });
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryTab, setDiscoveryTab] = useState("trending");
  const [freeGames, setFreeGames] = useState([]);
  const [freeGamesLoading, setFreeGamesLoading] = useState(true);
  const [freeGamesError, setFreeGamesError] = useState("");
  const [shopData, setShopData] = useState(null);
  const [shopDataLoading, setShopDataLoading] = useState(false);
  const [shopDataError, setShopDataError] = useState("");
  const [shopDataUpdatedAt, setShopDataUpdatedAt] = useState(null);
  const [regionalKeyPrice, setRegionalKeyPrice] = useState(null);
  const [conversionMode, setConversionMode] = useState("currency-to-keys");
  const [conversionAmount, setConversionAmount] = useState("18");
  const [regionalMarketData, setRegionalMarketData] = useState([]);
  const [regionalMarketLoading, setRegionalMarketLoading] = useState(false);
  const [regionalMarketError, setRegionalMarketError] = useState("");
  const [regionalMarketUpdatedAt, setRegionalMarketUpdatedAt] = useState(null);
  const calculatorRef = useRef(null);
  const gameRequestRef = useRef(0);
  const searchRef = useRef(null);
  const headerSearchRef = useRef(null);
  const debounceRef = useRef(null);

  function navigateTo(page) {
    const nextHash = page === "game" && appid ? `#/game/${appid}` : `#/${page}`;
    if (window.location.hash !== nextHash) window.history.pushState(null, "", nextHash);
    setCurrentPage(page);
    if (page !== "game") { setGame(null); setError(""); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function readApiResponse(response) {
    const text = await response.text();
    if (!text.trim()) {
      throw new Error("The SteamPulse API returned an empty response. Make sure both the Vite client and Express server are running with npm run dev.");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("The API returned a non-JSON response. Open the app through the Vite dev server and check that the Express API is running on port 3001.");
    }
  }

  async function loadGame(id = appid, cc = region) {
    if (!/^\d+$/.test(String(id))) {
      setError("Enter a valid numeric Steam AppID.");
      return;
    }
    setCurrentPage("game");
    if (window.location.hash !== `#/game/${id}`) window.history.pushState(null, "", `#/game/${id}`);
    const requestId = ++gameRequestRef.current;
    setLoading(true);
    setError("");
    setSearchOpen(false);
    // Hide the previous game's details immediately so stale art never remains visible.
    setGame(null);
    setRegionalPriceInput("");
    setSelectedEditionName("");
    setPurchaseTab("editions");
    try {
      const response = await fetch(`/api/game/${id}?cc=${cc}`);
      const data = await readApiResponse(response);
      if (requestId !== gameRequestRef.current) return;
      if (!response.ok) throw new Error(data.error || data.detail || "Unable to load this game.");
      setGame(data);
      // Keep the base game's default Steam edition selected in the purchase options.
      const baseGamePrice = data.price_overview?.final != null ? Number(data.price_overview.final) / 100 : null;
      const defaultEdition = (data.editions || []).find((edition) =>
        edition.priceValue != null && baseGamePrice != null &&
        Math.abs(Number(edition.priceValue) - baseGamePrice) < 0.01
      ) || (data.editions || []).find((edition) => edition.priceValue != null);
      setSelectedEditionName(defaultEdition?.name?.replace(/\s*-\s*\$\s*$/, "") || "");
      // Bundle discovery can be slow on some Steam pages; load it after the main game details.
      if (String(data.type || "").toLowerCase() !== "dlc") {
        fetch(`/api/game/${id}/bundles?cc=${cc}`)
          .then((response) => response.ok ? response.json() : null)
          .then((bundleData) => {
            if (!bundleData || !Array.isArray(bundleData.bundles)) return;
            if (requestId !== gameRequestRef.current) return;
            setGame((current) => String(current?.appid) === String(id)
              ? { ...current, bundles: bundleData.bundles }
              : current);
          })
          .catch(() => {});
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      setRegionalPriceInput(data.price_overview?.final != null ? (data.price_overview.final / 100).toFixed(2) : "");
      setAppid(String(id));
      setInputId(String(id));
      setQuery(data.name);
      setActiveTab("overview");
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreDlc() {
    if (!game || loadingMoreDlc || game.dlc.length >= game.dlc_total) return;
    setLoadingMoreDlc(true);
    setError("");
    try {
      const response = await fetch(`/api/game/${game.appid}/dlc?cc=${region}&offset=${game.dlc.length}&limit=24`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || data.detail || "Unable to load more DLC.");
      setGame((current) => {
        if (!current || String(current.appid) !== String(game.appid)) return current;
        const existing = new Set((current.dlc || []).map((item) => String(item.appid)));
        const newItems = (data.items || []).filter((item) => !existing.has(String(item.appid)));
        return { ...current, dlc: [...(current.dlc || []), ...newItems], dlc_total: data.total ?? current.dlc_total };
      });
    } catch (e) {
      setError(e.message || "Could not load more DLC.");
    } finally {
      setLoadingMoreDlc(false);
    }
  }

  async function searchGames(term) {
    if (term.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/search?term=${encodeURIComponent(term.trim())}&cc=${region}`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || data.detail || "Search failed.");
      setResults(data.items || []);
      setSearchOpen(true);
    } catch (e) {
      setResults([]);
      setError(e.message || "Steam search failed. Check that the API server is running.");
    } finally {
      setSearching(false);
    }
  }

  function onSearchChange(value) {
    setQuery(value);
    setSearchOpen(true);
    clearTimeout(debounceRef.current);
    if (/^\d+$/.test(value.trim())) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => searchGames(value), 300);
  }

  function chooseGame(item) {
    setQuery(item.name);
    setInputId(String(item.id));
    setSearchOpen(false);
    loadGame(item.id, region);
  }

  useEffect(() => {
    const syncPageFromHash = () => {
      const hash = window.location.hash;
      const gameMatch = hash.match(/^#\/game\/(\d+)/);
      if (gameMatch) {
        setCurrentPage("game");
        const targetId = gameMatch[1];
        if (String(game?.appid || "") !== targetId && !loading) loadGame(targetId, region);
        return;
      }
      const pageMatch = hash.match(/^#\/(home|games|trending|market|calculator|settings|profile)$/);
      const nextPage = pageMatch?.[1] || "home";
      setCurrentPage(nextPage);
      if (nextPage !== "game") { setGame(null); setLoading(false); }
    };
    window.addEventListener("popstate", syncPageFromHash);
    if (window.location.hash) syncPageFromHash();
    return () => window.removeEventListener("popstate", syncPageFromHash);
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (!searchRef.current?.contains(event.target) && !headerSearchRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentPage === "profile" || steamProfile.trim()) loadSteamProfile();
  }, [currentPage, steamProfile]);

  useEffect(() => {
    localStorage.setItem("steampulse-region", region);
    if (game) loadGame(appid, region);
  }, [region]);

  function saveSettings() {
    const cleanProfile = steamProfileDraft.trim();
    setSteamProfile(cleanProfile);
    localStorage.setItem("steampulse-profile", cleanProfile);
    const cleanApiKey = steamApiKeyDraft.trim();
    setSteamApiKey(cleanApiKey);
    localStorage.setItem("steampulse-api-key", cleanApiKey);
    localStorage.setItem("steampulse-region", region);
    setOwnership(null);
    setOwnershipError("");
  }

  async function loadSteamProfile() {
    if (!steamProfile.trim()) {
      setSteamProfileData(null);
      setSteamProfileError("Add your Steam profile in Settings first, then save it.");
      return;
    }
    setSteamProfileLoading(true);
    setSteamProfileError("");
    setSteamProfileData(null);
    try {
      const response = await fetch(`/api/steam-profile?profile=${encodeURIComponent(steamProfile)}`, { headers: steamApiKey ? { "X-Steam-API-Key": steamApiKey } : {} });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not load the Steam profile.");
      setSteamProfileData(data);
    } catch (e) {
      setSteamProfileError(e.message || "Could not load the Steam profile.");
    } finally {
      setSteamProfileLoading(false);
    }
  }

  async function checkOwnership() {
    if (!steamProfile.trim() || !game) {
      setOwnershipError("Add your Steam profile in Settings first.");
      return;
    }
    setOwnershipLoading(true);
    setOwnershipError("");
    try {
      const appids = [...new Set([Number(game.appid), ...(game.dlc || []).map((item) => Number(item.appid))].filter(Number.isFinite))];
      const response = await fetch("/api/ownership-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(steamApiKey ? { "X-Steam-API-Key": steamApiKey } : {}) },
        body: JSON.stringify({ profile: steamProfile, appids })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not check this Steam library.");
      setOwnership(data);
    } catch (e) {
      setOwnershipError(e.message || "Ownership check failed.");
    } finally {
      setOwnershipLoading(false);
    }
  }

  useEffect(() => {
    if (currentPage === "game" && game?.appid && game.type !== "dlc" && steamProfile && steamApiKey) checkOwnership();
  }, [currentPage, game?.appid, steamProfile, steamApiKey]);

  useEffect(() => {
    let cancelled = false;
    setDiscoveryLoading(true);
    setDiscoveryError("");
    fetch(`/api/discover?cc=${region}`)
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || data.detail || "Could not load game discovery.");
        return data;
      })
      .then((data) => {
        if (!cancelled) setDiscovery({
          newReleases: data.newReleases || [],
          upcoming: data.upcoming || [],
          topSellers: data.topSellers || []
        });
      })
      .catch((e) => {
        if (!cancelled) setDiscoveryError(e.message || "Game discovery is temporarily unavailable.");
      })
      .finally(() => { if (!cancelled) setDiscoveryLoading(false); });
    return () => { cancelled = true; };
  }, [region]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const loadShopData = async () => {
      setShopDataLoading(true);
      setShopDataError("");
      try {
        const response = await fetch("/api/shop-data");
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load live key prices.");
        const keyPrice = Number(String(data.Key ?? "").replace(/[\s,٬]/g, ""));
        if (!Number.isFinite(keyPrice) || keyPrice <= 0) throw new Error("The shop API returned an invalid key price.");
        if (!cancelled) { setShopData({ ...data, Key: keyPrice }); setShopDataUpdatedAt(new Date()); }
      } catch (error) {
        if (!cancelled) setShopDataError(error.message || "Live key prices are temporarily unavailable.");
      } finally {
        if (!cancelled) setShopDataLoading(false);
      }
    };
    loadShopData();
    timer = setInterval(loadShopData, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const loadRegionalKeyPrice = async () => {
      try {
        const response = await fetch(`/api/key-price?region=${encodeURIComponent(region)}`);
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load this region's Steam key price.");
        if (!cancelled) setRegionalKeyPrice(data);
      } catch (error) {
        if (!cancelled) setRegionalKeyPrice({ region, error: error.message || "Steam key price unavailable." });
      }
    };
    setRegionalKeyPrice(null);
    loadRegionalKeyPrice();
    timer = setInterval(loadRegionalKeyPrice, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [region]);

  useEffect(() => {
    if (currentPage !== "market") return;
    let cancelled = false;
    const loadRegionalMarket = async () => {
      setRegionalMarketLoading(true);
      setRegionalMarketError("");
      try {
        const response = await fetch("/api/market-regions");
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load Steam Market regional prices.");
        if (!cancelled) {
          setRegionalMarketData(Array.isArray(data.regions) ? data.regions : []);
          setRegionalMarketUpdatedAt(new Date());
        }
      } catch (error) {
        if (!cancelled) setRegionalMarketError(error.message || "Steam Market data is temporarily unavailable.");
      } finally {
        if (!cancelled) setRegionalMarketLoading(false);
      }
    };
    loadRegionalMarket();
    const timer = setInterval(loadRegionalMarket, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;
    setFreeGamesLoading(true);
    setFreeGamesError("");
    fetch(`/api/free-games?cc=${region}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load free Steam games.");
        return data;
      })
      .then((data) => { if (!cancelled) setFreeGames(data.items || []); })
      .catch((e) => { if (!cancelled) setFreeGamesError(e.message || "Free promotions are temporarily unavailable."); })
      .finally(() => { if (!cancelled) setFreeGamesLoading(false); });
    return () => { cancelled = true; };
  }, [region]);

  const hero = game?.library_hero || game?.header_image_2x || game?.header_image;
  const price = money(game?.price_overview);
  const selectedRegion = REGIONS.find((r) => r.code === region) || REGIONS[0];
  const numericRegionalPrice = Number(regionalPriceInput);
  const regionalKeyPriceValue = Number(regionalKeyPrice?.netPrice);
  const regionalKeyPriceForCalculation = regionalKeyPrice?.region === selectedRegion.code && Number.isFinite(regionalKeyPriceValue) && regionalKeyPriceValue > 0 ? regionalKeyPriceValue : 0;
  const keyCount = regionalPriceInput.trim() !== "" && regionalKeyPriceForCalculation > 0 && Number.isFinite(numericRegionalPrice) && numericRegionalPrice > 0 ? Math.ceil(numericRegionalPrice / regionalKeyPriceForCalculation) : 0;
  const liveKeyPriceToman = Number(shopData?.Key);
  const conversionValue = Number(conversionAmount);
  const conversionValid = conversionAmount.trim() !== "" && Number.isFinite(conversionValue) && conversionValue > 0;
  const conversionResult = !conversionValid ? null : conversionMode === "currency-to-keys" ? (regionalKeyPriceForCalculation > 0 ? conversionValue / regionalKeyPriceForCalculation : null) : conversionMode === "toman-to-keys" ? (liveKeyPriceToman > 0 ? conversionValue / liveKeyPriceToman : null) : conversionMode === "keys-to-toman" ? (liveKeyPriceToman > 0 ? conversionValue * liveKeyPriceToman : null) : (regionalKeyPriceForCalculation > 0 ? conversionValue * regionalKeyPriceForCalculation : null);
  const conversionResultLabel = conversionMode === "currency-to-keys" || conversionMode === "toman-to-keys" ? "Keys" : conversionMode === "keys-to-toman" ? "toman" : selectedRegion.currency;
  const conversionResultFormatted = conversionResult == null ? null : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(conversionResult);
  const totalToman = keyCount * (Number.isFinite(liveKeyPriceToman) && liveKeyPriceToman > 0 ? liveKeyPriceToman : 0);
  const systemNames = Object.entries(game?.platforms || {}).filter(([, supported]) => supported).map(([name]) => name);
  const tabNames = ["overview", "screenshots", "videos", "requirements", "steam news", "external news"];

  return (
    <div className="app-shell" data-theme={theme} style={game?.background ? { backgroundImage: theme === "dark" ? `linear-gradient(180deg, rgba(8,13,27,.84) 0%, rgba(8,13,27,.94) 34rem, #080d1b 85%), url("${game.background}")` : `linear-gradient(180deg, rgba(245,247,252,.78) 0%, rgba(245,247,252,.94) 34rem, #f5f7fc 85%), url("${game.background}")` } : undefined}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark"><Activity size={23} strokeWidth={2.5} /></span>
          <span>STEAM<span className="brand-accent">PULSE</span><small>GAME INTELLIGENCE</small></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">{[["home","Home"],["games","Games"],["trending","Trending"],["market","Market"],["calculator","Calculator"],["settings","Settings"]].map(([page,label]) => <button key={page} className={currentPage === page || (currentPage === "game" && page === "games") ? "active" : ""} onClick={() => navigateTo(page)}>{page === "home" ? <Activity size={15} /> : page === "games" ? <Gamepad2 size={15} /> : page === "trending" ? <Sparkles size={15} /> : page === "market" ? <Tag size={15} /> : page === "calculator" ? <Calculator size={15} /> : <Settings size={15} />}{label}</button>)}</nav>
        <div className="topbar-right">
          <div className="header-search-box" ref={headerSearchRef}>
            <Search size={16} className="header-search-icon" />
            <input value={query} onChange={(e) => onSearchChange(e.target.value)} onFocus={() => query.trim().length >= 2 && setSearchOpen(true)} onKeyDown={(e) => { if (e.key === "Enter") { if (/^\d+$/.test(query.trim())) loadGame(query.trim()); else if (results[0]) chooseGame(results[0]); else searchGames(query); } if (e.key === "Escape") setSearchOpen(false); }} placeholder="Search games…" aria-label="Search Steam games" />
            {searching && <LoaderCircle size={15} className="spin" />}
            {query && <button className="header-search-clear" onClick={() => { setQuery(""); setResults([]); setSearchOpen(false); }} aria-label="Clear search"><X size={14} /></button>}
            {searchOpen && results.length > 0 && <div className="search-results header-search-results"><div className="results-label">STEAM STORE RESULTS <span>{results.length} MATCHES</span></div>{results.slice(0, 6).map((item) => <button className="result-row" key={item.id} onClick={() => chooseGame(item)}><img src={item.tiny_image} alt="" loading="lazy" /><span className="result-name">{item.name}<small>APP ID · {item.id}</small></span><span className="result-type">{item.type || "game"}</span><ChevronRight size={16} /></button>)}</div>}
          </div>
          <button className="theme-toggle" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
          <span className="online-pill"><span className="status-dot" /> API READY</span><button className={`avatar-button ${steamProfileData?.profile ? (steamProfileData.profile.currentGame ? "has-steam-game" : steamProfileData.profile.online ? "is-steam-online" : "is-steam-offline") : ""}`} title={steamProfileData?.profile?.currentGame ? `In game: ${steamProfileData.profile.currentGame.name}` : steamProfileData?.profile ? (steamProfileData.profile.online ? "Online" : "Offline") : "Steam profile"} aria-label="Open Steam profile" onClick={() => navigateTo("profile")}>{steamProfileData?.profile?.avatar ? <img className="avatar steam-avatar" src={steamProfileData.profile.avatarAnimated || steamProfileData.profile.avatar} alt="" /> : <span className="avatar"><UserRound size={19} /></span>}{steamProfileData?.profile && <i className="header-steam-status-dot" aria-hidden="true" />}</button></div>
      </header>

      <main className="main-content">
        {currentPage === "profile" && <section className="steam-profile-page">
          {steamProfileData?.profile?.backgroundVideo ? <video key={`${steamProfileData.profile.steamId}-${steamProfileData.profile.backgroundVideo}`} className="steam-profile-background-video" autoPlay muted loop playsInline poster={steamProfileData.profile.background || undefined} aria-hidden="true"><source src={steamProfileData.profile.backgroundVideo} type="video/webm" /></video> : steamProfileData?.profile?.background ? <div key={`${steamProfileData.profile.steamId}-${steamProfileData.profile.background}`} className="steam-profile-background-image" style={{ backgroundImage: `url("${steamProfileData.profile.background}")` }} aria-hidden="true" /> : null}
          {steamProfileLoading && <div className="profile-loading detail-card"><LoaderCircle className="spin" size={22} /> Loading Steam profile…</div>}
          {steamProfileError && !steamProfileLoading && <div className="profile-error detail-card"><UserRound size={24} /><h2>Steam profile unavailable</h2><p>{steamProfileError}</p><button className="primary-button" onClick={() => navigateTo("settings")}><Settings size={15} /> Open Settings</button><button className="secondary-button" onClick={loadSteamProfile}><RefreshCw size={15} /> Try again</button></div>}
          {steamProfileData && !steamProfileLoading && <>
            <section className="steam-profile-hero detail-card">
              <div className="steam-profile-cover" />
              <div className="steam-profile-identity">
                <span className="steam-profile-avatar-wrap"><img className="steam-profile-avatar" src={steamProfileData.profile.avatarAnimated || steamProfileData.profile.avatar} alt="" />{steamProfileData.profile.avatarFrame && <img className="steam-profile-avatar-frame" src={steamProfileData.profile.avatarFrame} alt="" aria-hidden="true" />}</span>
                <div className="steam-profile-name"><span className="section-kicker"><UserRound size={13} /> STEAM ACCOUNT</span><div className="steam-profile-title-row"><h1>{steamProfileData.profile.name || "Steam user"}</h1>{(() => { const rawLevel = Number(steamProfileData.stats.level); const level = Number.isFinite(rawLevel) && rawLevel >= 0 ? Math.floor(rawLevel) : null; const shapes = ["hexagons", "shields", "books", "chevrons", "circles", "angles", "flags", "wings", "arrows", "crystals", "space", "water", "fire", "earth"]; const colors = ["#8b929a", "#e35d5b", "#e58b45", "#e2c34c", "#80b95b", "#66a8d8", "#9274d8", "#d77bbd", "#9f5965", "#b58b5a"]; const shape = level == null || level < 100 ? null : shapes[Math.min(shapes.length - 1, Math.floor(level / 100) - 1)]; const style = level == null ? {} : level < 100 ? { "--steam-level-color": colors[Math.floor(level / 10)] } : { backgroundImage: `url(https://community.fastly.steamstatic.com/public/shared/images/community/levels_${shape}.png)`, backgroundPosition: `0 -${Math.floor((level % 100) / 10) * 42}px` }; return <span className={`steam-level-frame steam-profile-level ${level != null && level >= 100 ? "is-sprite" : ""}`} style={style}><span>{level == null ? "—" : formatNumber(level)}</span></span>; })()}</div><p>{steamProfileData.profile.realName || "Steam community member"}{steamProfileData.profile.country ? ` · ${steamProfileData.profile.country}` : ""}</p>{(() => { const status = String(steamProfileData.profile.status || "Offline").toLowerCase(); const isAway = status === "away" || status === "snooze"; const statusClass = steamProfileData.profile.currentGame ? "steam-in-game" : isAway ? "steam-away" : steamProfileData.profile.online ? "steam-online" : "steam-offline"; return <span className={statusClass}><i aria-hidden="true" />{steamProfileData.profile.status || "Offline"}</span>; })()}</div>
                <a className="profile-steam-link" href={steamProfileData.profile.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View on Steam</a>
              </div>
              {steamProfileData.profile.summary && <p className="steam-profile-summary">{steamProfileData.profile.summary}</p>}
            </section>
            <section className="profile-stats-grid">
              <div className="profile-stat detail-card"><div className="profile-stat-heading"><Library size={19} /><span>Games owned</span></div><strong className="profile-stat-value">{steamProfileData.stats.games == null ? "Private" : formatNumber(steamProfileData.stats.games)}</strong></div>
              <div className="profile-stat detail-card"><div className="profile-stat-heading"><Clock3 size={19} /><span>Total playtime</span></div><strong className="profile-stat-value">{steamProfileData.stats.hours == null ? "Private" : `${formatNumber(steamProfileData.stats.hours)} hrs`}</strong></div>
              
              {steamProfileData.yearOfService && <div className="profile-stat profile-badge-stat detail-card"><div className="profile-stat-heading"><Trophy size={19} /><span>Years of Service</span></div><span className="profile-badge-art"><img className="profile-badge-image" src={steamProfileData.yearOfService.image} alt="Years of Service badge" loading="lazy" /></span></div>}
              <div className="profile-stat profile-badge-stat detail-card"><div className="profile-stat-heading"><Trophy size={19} /><span>Badges earned</span></div><strong className="profile-stat-value">{steamProfileData.stats.badges == null ? "—" : formatNumber(steamProfileData.stats.badges)}</strong></div>
            </section>
            <section className="profile-content-grid">
              {steamProfileData.profile.currentGame && <div className="detail-card profile-current-game">
                <div className="card-title"><Gamepad2 size={17} /><h3>Currently playing</h3>{steamProfileData.profile.currentGame && <span className="current-game-live"><i /> IN-GAME</span>}</div>
                {steamProfileData.profile.currentGame
                  ? <div className="current-game-content">
                      {steamProfileData.profile.currentGame.appid && <a className="current-game-art" href={`https://store.steampowered.com/app/${steamProfileData.profile.currentGame.appid}/`} target="_blank" rel="noreferrer"><img src={`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamProfileData.profile.currentGame.appid}/header.jpg`} alt={`${steamProfileData.profile.currentGame.name} cover`} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = `https://cdn.akamai.steamstatic.com/steam/apps/${steamProfileData.profile.currentGame.appid}/header.jpg`; }} /></a>}
                      <span className="current-game-copy"><strong>{steamProfileData.profile.currentGame.name}</strong><small>Playing right now</small></span>
                      {steamProfileData.profile.currentGame.appid && <a className="current-game-open" href={`https://store.steampowered.com/app/${steamProfileData.profile.currentGame.appid}/`} target="_blank" rel="noreferrer" aria-label="Open game on Steam"><ExternalLink size={15} /></a>}
                    </div>
                  : null}
              </div>}
              <div className="detail-card profile-recent"><div className="card-title"><Clock3 size={17} /><h3>Recently played</h3></div>{steamProfileData.recentGames.length ? steamProfileData.recentGames.map((item) => <a className="recent-game-row" key={item.appid} href={`https://store.steampowered.com/app/${item.appid}/`} target="_blank" rel="noreferrer"><img src={item.image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.appid}/header.jpg`} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; event.currentTarget.parentElement.classList.add("recent-game-no-capsule"); }} /><span>{item.name}<small>{formatNumber(item.hours2Weeks)} hrs in last 2 weeks · {formatNumber(item.hours)} hrs total</small></span><ExternalLink size={14} /></a>) : <p className="profile-muted">No recent games available, or the profile's game details are private.</p>}</div>
              <div className="detail-card profile-account"><div className="card-title"><UsersRound size={17} /><h3>Account details</h3></div><dl><div><dt>SteamID64</dt><dd>{steamProfileData.profile.steamId}</dd></div><div><dt>Account created</dt><dd>{steamProfileData.profile.created || "Not public"}</dd></div><div><dt>Last online</dt><dd>{steamProfileData.profile.lastLogoff || "Not available"}</dd></div><div><dt>Profile visibility</dt><dd>{steamProfileData.profile.visibility || "Unknown"}</dd></div><div><dt>Friends count</dt><dd>{steamProfileData.stats.friends == null ? "Private / unavailable" : formatNumber(steamProfileData.stats.friends)}</dd></div></dl><a className="profile-full-link" href={steamProfileData.profile.url} target="_blank" rel="noreferrer">Open full Steam profile <ExternalLink size={13} /></a></div>
            </section>
          </>}
        </section>}

        {currentPage === "market" && <section className="market-page">
          <div className="market-heading"><div><span className="section-kicker"><Tag size={13} /> STEAMPULSE MARKET</span><h1>Steam key market</h1><p>Live Iranian shop prices, stock and purchase links.</p></div><button className="market-refresh" onClick={() => { setShopDataLoading(true); setShopDataError(""); fetch("/api/shop-data").then(async (response) => { const data = await readApiResponse(response); if (!response.ok) throw new Error(data.error || "Could not load live key prices."); return data; }).then((data) => { setShopData(data); setShopDataUpdatedAt(new Date()); }).catch((error) => setShopDataError(error.message || "Refresh failed.")).finally(() => setShopDataLoading(false)); }} disabled={shopDataLoading}><RefreshCw size={14} className={shopDataLoading ? "spin" : ""} /> Refresh prices</button></div>
          <section className="regional-market-section detail-card">
            <div className="regional-market-heading">
              <div><span className="section-kicker"><Globe2 size={13} /> STEAM COMMUNITY MARKET</span><h2>TF2 Key · Regional prices</h2><p>Live market sell orders and estimated proceeds from Steam's order histogram.</p></div>
              <span className={regionalMarketError ? "regional-market-live is-error" : "regional-market-live"}><span />{regionalMarketError ? "Unavailable" : regionalMarketLoading && !regionalMarketData.length ? "Loading market…" : "LIVE"}</span>
            </div>
            {regionalMarketError && <div className="market-error"><Info size={16} />{regionalMarketError}</div>}
            {regionalMarketLoading && !regionalMarketData.length ? <div className="market-loading"><LoaderCircle size={20} className="spin" /> Loading regional Steam Market orders…</div> : <>
              <div className="regional-order-summary">
                <div className="regional-order-stat"><span>Sell orders · Steam market</span><strong>{(() => { const value = Number(String(regionalMarketData.find((item) => item.code === "US")?.sellOrderCount ?? "").replace(/[，,\s]/g, "")); return Number.isFinite(value) && value > 0 ? formatNumber(value) : "—"; })()}</strong></div>
                <div className="regional-order-stat"><span>Buy orders · Steam market</span><strong>{(() => { const value = Number(String(regionalMarketData.find((item) => item.code === "US")?.buyOrderCount ?? "").replace(/[，,\s]/g, "")); return Number.isFinite(value) && value > 0 ? formatNumber(value) : "—"; })()}</strong></div>
              </div>
              <div className="regional-market-table-wrap">
                <table className="regional-market-table">
                  <thead><tr><th>Country / region</th><th>Lowest sell</th><th>Net estimate</th><th>Change</th></tr></thead>
                  <tbody>
                    {regionalMarketData.map((item) => <tr key={item.code}>
                      <td><span className="regional-name"><img className="regional-flag" src={`https://flagcdn.com/w40/${item.code === "EU" ? "eu" : item.country.toLowerCase()}.png`} alt="" loading="lazy" /><span><strong>{item.label}</strong></span></span></td>
                      <td className="regional-price">{item.lowestSellFormatted || "—"}</td>
                      <td className="regional-net">{item.netFormatted || "—"}</td>
                      <td><span className={item.change == null ? "regional-change" : item.change > 0 ? "regional-change up" : item.change < 0 ? "regional-change down" : "regional-change"}>{item.change == null ? "—" : item.change > 0 ? `▲ ${item.changeFormatted}` : item.change < 0 ? `▼ ${item.changeFormatted}` : "—"}</span></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </>}
            <p className="market-footnote"><Info size={14} /> Prices come from Steam Community Market order histograms. Net estimate subtracts an estimated 13% marketplace fee; it is indicative, not a guaranteed payout. {regionalMarketUpdatedAt ? `Last fetched: ${regionalMarketUpdatedAt.toLocaleTimeString()}.` : ""}</p>
          </section>
          <div className="market-status"><span className={shopDataError ? "market-status-dot is-error" : "market-status-dot"} />{shopDataError ? "Live data unavailable" : shopDataLoading && !shopData ? "Connecting to shop API…" : "Live shop data"}<span className="market-updated">{shopData?.LastUpdateDate ? `Source updated: ${shopData.LastUpdateDate}` : shopDataUpdatedAt ? `Fetched: ${shopDataUpdatedAt.toLocaleTimeString()}` : "Waiting for first update"}</span></div>
          {shopDataError && <div className="market-error"><Info size={16} />{shopDataError}</div>}
          {shopDataLoading && !shopData ? <div className="market-loading detail-card"><LoaderCircle size={22} className="spin" /> Loading live prices…</div> : shopData && <>
            <div className="market-product-grid">
              <article className="market-product-card detail-card"><div className="market-product-top"><img className="market-product-image" src="https://community.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEAaR4uURrwvz0N252yVaDVWrRTno9m4ccG2GNqxlQoZrC2aG9hcVGUWflbX_drrVu5UGki5sAij6tOtQ" alt="Mann Co. Supply Crate Key" loading="lazy" /><span className="market-live-tag">LIVE PRICE</span></div><span className="market-product-label">TF2 Key</span><strong className="market-price">{formatNumber(shopData.Key)} <small>toman</small></strong><div className="market-product-meta"><span>Available stock</span><strong>{formatNumber(shopData.KeyStock)} keys</strong></div><a className="market-buy-button" href={shopData.KeyUrl} target="_blank" rel="noreferrer">Buy TF2 Keys <ExternalLink size={14} /></a></article>
              <article className="market-product-card detail-card"><div className="market-product-top"><img className="market-product-image" src="https://community.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEGegouSRLhsz1Xt8TnH_WJRuNVy49itMUB32JtklgoN7OzZTQxJFPEV_lfBa1irV-9C3Zr6sU6AdH457UBdvwbXdU" alt="Tour of Duty Ticket" loading="lazy" /><span className="market-live-tag">LIVE PRICE</span></div><span className="market-product-label">TF2 Ticket</span><strong className="market-price">{formatNumber(shopData.Ticket)} <small>toman</small></strong><div className="market-product-meta"><span>Available stock</span><strong>{formatNumber(shopData.TicketStock)} tickets</strong></div><a className="market-buy-button" href={shopData.TicketUrl} target="_blank" rel="noreferrer">Buy TF2 Tickets <ExternalLink size={14} /></a></article>
            </div>
            <p className="market-footnote"><Info size={14} /> Prices are refreshed automatically every 60 seconds. Last source update: {shopData.LastUpdateDate || (shopData.LastUpdate ? new Date(Number(shopData.LastUpdate) * 1000).toLocaleString() : "not provided")}.</p>
          </>}
        </section>}

        {currentPage === "calculator" && <section className="conversion-page">
          <div className="conversion-heading"><div><span className="section-kicker"><Calculator size={13} /> STEAMPULSE CONVERTER</span><h1>Key calculator</h1><p>Convert between Steam regional prices, TF2 keys and your local shop price using live data.</p></div><span className="conversion-live"><i /> LIVE RATES</span></div>
          <section className="conversion-card detail-card">
            <label className="conversion-region"><span><Globe2 size={15} /> Steam price region</span><select value={region} onChange={(e) => { setRegion(e.target.value); localStorage.setItem("steampulse-region", e.target.value); }}>{REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label} ({r.code} · {r.currency})</option>)}</select></label>
            <div className="conversion-mode-grid">
              {[["currency-to-keys", "Currency to keys", "18 USD → keys"], ["toman-to-keys", "Toman to keys", "800,000 toman → keys"], ["keys-to-toman", "Keys to toman", "5 keys → toman"], ["keys-to-currency", "Keys to currency", "5 keys → USD"]].map(([mode,label,hint]) => <button type="button" key={mode} className={conversionMode === mode ? "active" : ""} onClick={() => { setConversionMode(mode); setConversionAmount(mode === "currency-to-keys" ? "18" : mode === "toman-to-keys" ? "800000" : "5"); }}><strong>{label}</strong><small>{hint}</small></button>)}
            </div>
            <label className="conversion-input"><span>{conversionMode === "currency-to-keys" ? "Amount (" + selectedRegion.currency + ")" : conversionMode === "toman-to-keys" ? "Amount (toman)" : "Number of keys"}</span><div><input type="number" min="0" step="any" value={conversionAmount} onChange={(e) => setConversionAmount(e.target.value)} placeholder="Enter amount" /><b>{conversionMode === "currency-to-keys" ? selectedRegion.currency : conversionMode === "toman-to-keys" || conversionMode === "keys-to-toman" ? "TOMAN" : "KEYS"}</b></div></label>
            <div className="conversion-result"><span>CONVERTED VALUE</span>{conversionResult == null ? <strong>—</strong> : <><strong>{conversionResultFormatted} <small>{conversionResultLabel}</small></strong>{(conversionMode === "currency-to-keys" || conversionMode === "toman-to-keys") && <p>For a whole-key purchase: <b>{formatNumber(Math.ceil(conversionResult))} keys</b></p>}</>}{conversionResult == null && <p>{conversionMode === "currency-to-keys" || conversionMode === "keys-to-currency" ? regionalKeyPrice?.error || "Loading regional Steam key price…" : shopDataError || "Loading live shop key price…"}</p>}</div>
            <div className="conversion-rate-grid"><div><small>REGIONAL KEY VALUE · NET</small><strong>{regionalKeyPriceForCalculation > 0 ? regionalKeyPriceForCalculation.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + selectedRegion.currency : "Loading…"}</strong></div><div><small>SHOP KEY PRICE</small><strong>{liveKeyPriceToman > 0 ? formatNumber(liveKeyPriceToman) + " toman" : "Loading…"}</strong></div></div>
            <p className="conversion-footnote"><Info size={14} /> Regional conversions use Steam’s live net key value for the selected region. Toman conversions use the live key price from the SteamPulse shop feed. Results are estimates.</p>
          </section>
        </section>}

        {currentPage === "settings" && <section className="settings-page detail-card">
          <div className="settings-heading"><span className="section-kicker"><Settings size={13} /> PERSONAL PREFERENCES</span><h1>Settings</h1><p>Save your default Steam price region and profile for quick library checks.</p></div>
          <div className="settings-form">
            <label><span><Globe2 size={16} /> Default price region</span><select value={region} onChange={(e) => setRegion(e.target.value)}>{REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label} ({r.code} · {r.currency})</option>)}</select><small>This region is remembered in this browser and used for future game lookups.</small></label>
            <label><span><Users size={16} /> Steam profile URL or SteamID64</span><input value={steamProfileDraft} onChange={(e) => setSteamProfileDraft(e.target.value)} placeholder="https://steamcommunity.com/profiles/7656… or /id/username" /><small>Your profile and owned games must be public for library checks.</small></label>
            <button className="primary-button" onClick={saveSettings}><Save size={16} /> Save settings</button>
            {steamProfile && <p className="settings-saved"><CheckCircle2 size={15} /> Steam profile saved in this browser.</p>}
          </div>
          <div className="settings-form api-key-settings">
            <label><span><ShieldCheck size={16} /> Your Steam Web API Key</span><input type="password" autoComplete="off" value={steamApiKeyDraft} onChange={(e) => setSteamApiKeyDraft(e.target.value)} placeholder="Paste your Steam Web API key" /><small>Your key is saved only in this browser and sent to the SteamPulse server when you request Steam account data. Never share it with anyone.</small></label>
            <div className="api-key-guide"><strong>How to get your key</strong><ol><li>Open the official Steam API key page and sign in to your Steam account.</li><li>Enter a domain name if Steam asks, then accept the terms and register.</li><li>Copy the key shown by Steam and paste it above.</li></ol><a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noreferrer"><ExternalLink size={14} /> Get your Steam Web API Key</a></div>
          </div>
          <div className="settings-note"><ShieldCheck size={18} /><div><strong>About ownership checks</strong><p>Your personal key is used for profile statistics and library checks. Steam may not expose every DLC as a separate owned app, so DLC results are best-effort, not a purchase receipt. You can remove the key from this field and save settings to clear it from this browser.</p></div></div>
        </section>}

        {(currentPage === "home" || currentPage === "games") && <>
        {currentPage === "home" && <section className="intro">
          <div className="eyebrow"><Sparkles size={14} /> YOUR STEAM COMMAND CENTER</div>
          <h1>Every game.<br /><span>One pulse.</span></h1>
          <p>Explore game data, pricing, player activity and visual details from the Steam Store.</p>
        </section>}

        <section className="search-panel">
          <div className="search-heading"><div><span className="section-kicker">DISCOVER</span><h2>Find your next game</h2></div><span className="search-hint">Search by title or use an AppID</span></div>
          <div className="search-controls">
            <div className="search-box" ref={searchRef}>
              <Search size={19} className="search-symbol" />
              <input
                value={query}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => query.trim().length >= 2 && setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (/^\d+$/.test(query.trim())) loadGame(query.trim());
                    else if (results[0]) chooseGame(results[0]);
                    else searchGames(query);
                  }
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                placeholder="Search Steam games… e.g. Elden Ring"
                aria-label="Search Steam games"
              />
              {searching && <LoaderCircle className="spin" size={18} />}
              {query && <button className="icon-button clear-search" onClick={() => { setQuery(""); setResults([]); setSearchOpen(false); }} aria-label="Clear search"><X size={16} /></button>}
              {searchOpen && results.length > 0 && <div className="search-results">
                <div className="results-label">STEAM STORE RESULTS <span>{results.length} MATCHES</span></div>
                {results.slice(0, 8).map((item) => <button className="result-row" key={item.id} onClick={() => chooseGame(item)}>
                  <img src={item.tiny_image} alt="" loading="lazy" />
                  <span className="result-name">{item.name}<small>APP ID · {item.id}</small></span>
                  <span className="result-type">{item.type || "game"}</span><ChevronRight size={16} />
                </button>)}
              </div>}
              {searchOpen && !searching && query.trim().length >= 2 && results.length === 0 && <div className="search-results empty-results">No matches yet. Try another title or enter an AppID.</div>}
            </div>
            <button className="primary-button" onClick={() => /^\d+$/.test(query.trim()) ? loadGame(query.trim()) : results[0] ? chooseGame(results[0]) : searchGames(query)}><Search size={17} /> Search</button>
            <div className="app-id-box"><label htmlFor="appid">APP ID</label><input id="appid" value={inputId} onChange={(e) => setInputId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadGame(inputId)} /><button onClick={() => loadGame(inputId)} aria-label="Load AppID"><ChevronRight size={18} /></button></div>
          </div>
          <div className="popular-line"><span>POPULAR NEW RELEASES</span>{discoveryLoading && !discovery.newReleases.length ? <small>Loading Steam releases…</small> : discovery.newReleases.slice(0, 6).map((g) => <a key={g.id} href={"#/game/" + g.id} onClick={() => {setQuery(g.name);setInputId(String(g.id));loadGame(g.id, region);}}>{g.name}</a>)}{!discoveryLoading && !discovery.newReleases.length && <small>{discoveryError || "No new releases available right now."}</small>}</div>
        </section>
        {currentPage === "games" && <section className="browse-games-section">
          <div className="discovery-heading"><div><span className="section-kicker"><Gamepad2 size={13} /> GAME LIBRARY</span><h2>Top Sellers</h2><p>The most popular games players are buying on Steam right now.</p></div><span className="section-count">{discovery.topSellers.length ? `${discovery.topSellers.length} GAMES` : ""}</span></div>
          {discoveryLoading && !discovery.topSellers.length
            ? <div className="discovery-loading"><LoaderCircle size={20} className="spin" />Loading Steam top sellers…</div>
            : discovery.topSellers.length
              ? <div className="browse-games-list">
                  {discovery.topSellers.filter((item) => Number(item.priceValue) > 0 || (item.priceValue == null && !/\bfree\b/i.test(String(item.price || "")) && String(item.price || "").trim() !== "")).slice(0, 20).map((item, index) => <a className="browse-game-card" key={item.id} href={"#/game/" + item.id} onClick={() => { setQuery(item.name); setInputId(String(item.id)); loadGame(item.id, region); }}>
                    <span className="browse-game-rank">{index + 1}</span>
                    <img src={item.image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`} alt="" loading="lazy" />
                    <span className="browse-game-info">
                      <strong>{item.name}</strong>
                      <span className="browse-game-release">{item.releaseDate || "Release date unavailable"}</span>
                    </span>
                    <span className="browse-game-price-area">
                      {item.discountPercent > 0 && <span className="browse-game-discount">-{item.discountPercent}%</span>}
                      <strong className="browse-game-price">{item.price || "Price unavailable"}</strong>
                      <ChevronRight className="browse-game-arrow" size={17} />
                    </span>
                  </a>)}
                </div>
              : <div className="discovery-message">{discoveryError || "Top sellers are temporarily unavailable. Try again shortly."}</div>}
        </section>}
        </>}
        
        {currentPage === "trending" && <>
        <section className="discovery-section">
          <div className="discovery-heading">
            <div><span className="section-kicker"><Sparkles size={13} /> STEAM RADAR</span><h2>What’s hot right now</h2><p>Fresh releases, upcoming launches, and games players are buying.</p></div>
            <button className="discovery-refresh" onClick={() => {
              setDiscoveryLoading(true); setDiscoveryError("");
              fetch(`/api/discover?cc=${region}&refresh=1`)
                .then(async (response) => { const data = await readApiResponse(response); if (!response.ok) throw new Error(data.error || data.detail || "Refresh failed."); return data; })
                .then((data) => setDiscovery({ newReleases: data.newReleases || [], upcoming: data.upcoming || [], topSellers: data.topSellers || [] }))
                .catch((e) => setDiscoveryError(e.message || "Refresh failed."))
                .finally(() => setDiscoveryLoading(false));
            }} disabled={discoveryLoading}><RefreshCw size={14} className={discoveryLoading ? "spin" : ""} /> Refresh</button>
          </div>
          <div className="discovery-tabs">
            {[["trending","Trending"],["new","New releases"],["upcoming","Coming soon"]].map(([key,label]) => <button key={key} className={discoveryTab === key ? "active" : ""} onClick={() => setDiscoveryTab(key)}>{label}</button>)}
          </div>
          {discoveryError && <div className="discovery-message"><Info size={15} />{discoveryError}</div>}
          {discoveryLoading && !discovery.newReleases.length && !discovery.upcoming.length && !discovery.topSellers.length
            ? <div className="discovery-loading"><LoaderCircle size={20} className="spin" />Finding games worth your attention…</div>
            : <div className="discovery-grid">
              {(discoveryTab === "new" ? discovery.newReleases : discoveryTab === "upcoming" ? discovery.upcoming : discovery.topSellers).slice(0, 8).map((item) => <a className="discovery-card" key={item.id} href={"#/game/" + item.id} onClick={() => { setQuery(item.name); setInputId(String(item.id)); loadGame(item.id, region); }}>
                <span className="discovery-image-wrap"><img src={item.image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`} alt="" loading="lazy" /><span className="discovery-badge">{item.badge}</span></span>
                <span className="discovery-card-copy"><strong>{item.name}</strong><span className="discovery-card-meta">{item.releaseDate || item.subtitle || "Steam game"}{item.price ? <b>{item.price}</b> : discoveryTab === "upcoming" ? <b>Price not announced</b> : null}</span></span>
              </a>)}
            </div>}
          {!discoveryLoading && !discoveryError && !(discoveryTab === "new" ? discovery.newReleases : discoveryTab === "upcoming" ? discovery.upcoming : discovery.topSellers).length && <div className="discovery-message">No titles available in this category right now.</div>}
          <div className="discovery-sources"><span>Want deeper trend data?</span><a href="https://steamdb.info/stats/mostwished/?displayOnly=Game" target="_blank" rel="noreferrer">Most wishlisted <ExternalLink size={11} /></a><a href="https://steamdb.info/stats/wishlistactivity/?upcoming_only=1" target="_blank" rel="noreferrer">Rising wishlist activity <ExternalLink size={11} /></a><a href="https://steamdb.info/upcoming/" target="_blank" rel="noreferrer">Upcoming releases <ExternalLink size={11} /></a></div>
          <div className="discovery-footnote">Discovery data from Steam Store · Select a game to open its full SteamPulse profile</div>
        </section>

        <section className="free-games-section">
          <div className="discovery-heading">
            <div><span className="section-kicker"><Gift size={13} /> FREE GAME ALERT</span><h2>Free right now</h2><p>Claim limited-time offers before they expire. Free weekends are temporary; Free to Keep offers stay in your library.</p></div>
            <button className="discovery-refresh" onClick={() => {
              setFreeGamesLoading(true); setFreeGamesError("");
              fetch(`/api/free-games?cc=${region}&refresh=1`)
                .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Refresh failed."); return data; })
                .then((data) => setFreeGames(data.items || []))
                .catch((e) => setFreeGamesError(e.message || "Refresh failed."))
                .finally(() => setFreeGamesLoading(false));
            }} disabled={freeGamesLoading}><RefreshCw size={14} className={freeGamesLoading ? "spin" : ""} /> Refresh</button>
          </div>
          {freeGamesError && <div className="discovery-message"><Info size={15} />{freeGamesError}</div>}
          {freeGamesLoading && !freeGames.length
            ? <div className="discovery-loading"><LoaderCircle size={20} className="spin" />Checking current free offers…</div>
            : freeGames.length
              ? <div className="discovery-grid">
                  {freeGames.map((item) => <article className="free-game-card" key={item.id}>
                    <a className="free-game-main" href={"#/game/" + item.id} onClick={() => { setQuery(item.name); setInputId(String(item.id)); loadGame(item.id, region); }}>
                      <span className="discovery-image-wrap"><img src={item.image} alt="" loading="lazy" /><span className="discovery-badge">{item.offerType}</span></span>
                      <span className="discovery-card-copy"><strong>{item.name}</strong><span className="discovery-card-meta">{item.originalPrice ? <><s>{item.originalPrice}</s> <b>{item.currentPrice || "Free"}</b></> : "Limited-time offer · confirm on Steam"}</span></span>
                    </a>
                    <a className="free-game-claim" href={item.url} target="_blank" rel="noreferrer">Claim on Steam <ExternalLink size={12} /></a>
                  </article>)}
                </div>
              : !freeGamesError && <div className="discovery-message">No active full-game promotions found right now. Check again later!</div>}
          <div className="discovery-sources"><span>Promotion data:</span><a href="https://steamdb.info/upcoming/free/" target="_blank" rel="noreferrer">SteamDB free promotions <ExternalLink size={11} /></a></div>
          <div className="discovery-footnote">Only full games are shown here; DLC and hardware listings are excluded. Always confirm the offer and deadline on Steam.</div>
        </section>

        </>}

        {currentPage === "game" && error && <div className="error-banner"><Info size={18} /><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}
        {loading && <div className="loading-panel"><LoaderCircle className="spin" size={26} /><span>Syncing game data from Steam…</span></div>}

        {currentPage === "home" && !loading && <section className="welcome-panel"><Sparkles size={28} /><h2>Your next favorite game is out there</h2><p>Search the Steam catalog or open Trending to discover what’s hot and what’s free right now.</p></section>}
        {currentPage === "game" && !game && !loading && <section className="welcome-panel"><Gamepad2 size={36} /><h2>Ready when you are</h2><p>Search for a game above to pull its Steam Store details.</p></section>}

        {currentPage === "game" && game && <>
          <section className="game-hero">
            <div className="hero-art" style={{backgroundImage: game?.library_hero ? `linear-gradient(90deg, rgba(8,13,27,.82) 0%, rgba(8,13,27,.68) 48%, rgba(8,13,27,.5) 100%), url("${game.library_hero}")` : hero ? `linear-gradient(90deg, rgba(8,13,27,.92) 0%, rgba(8,13,27,.82) 48%, rgba(8,13,27,.58) 100%), url("${hero}")` : "linear-gradient(120deg,#172541,#111827)"}} />
            <div className="hero-header-image"><img src={game.header_image || hero || ""} alt={`${game.name} header`} onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /></div>
            <div className="hero-content">
              <div className="hero-topline game-hero-topline"></div>
              <h2>{game.name}</h2>{game.developers?.length > 0 && <div className="hero-developer">Developed by {game.developers.slice(0, 2).join(", ")}</div>}<p className="hero-description">{game.short_description || game.about_the_game?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 320) || "No short description is available for this title."}</p>{game.type !== "dlc" && <div className="title-ownership-status"><span className="section-kicker"><Library size={13} /> YOUR LIBRARY</span>{ownershipLoading ? <strong>Checking…</strong> : ownership ? (() => { const title = ownership.items.find((item) => Number(item.appid) === Number(game.appid)); return <strong className={title?.owned ? "owned" : "not-owned"}>{title?.owned ? "✓ Owned" : "Not owned"}</strong>; })() : <strong>{steamProfile && steamApiKey ? "Checking…" : "Add profile + API key in Settings"}</strong>}</div>}<div className="title-extra-meta">{(game.genres || []).slice(0, 4).map((genre) => <span className="tag" key={genre}>{genre}</span>)}</div>
              <div className="hero-meta">
                <span><CalendarDays size={15} /> {game.release_date || "Release date unknown"}</span>
                <div className="hero-platforms" aria-label="Supported platforms">
                  {systemNames.length ? systemNames.map((platform) => <span className="platform-icon" key={platform} title={platform} aria-label={platform}>
                    {platform.toLowerCase() === "windows" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5.2 10.5 4v7.7H2V5.2Zm10-1.4L22 2v9.7H12V3.8ZM2 12.9h8.5v7.7L2 19.4v-6.5Zm10 0h10V22l-10-1.4v-7.7Z" fill="currentColor"/></svg> : platform.toLowerCase() === "mac" || platform.toLowerCase() === "macos" ? <img className="platform-logo platform-macos" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/apple/apple-original.svg" alt="" /> : platform.toLowerCase() === "linux" ? <img className="platform-logo platform-linux" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg" alt="" /> : <Monitor size={15} />}
                  </span>) : <span className="platform-unavailable">Platform data unavailable</span>}
                </div>
{game.type !== "dlc" && <span className={`hero-deck-status deck-status-${game.steam_deck?.status || "unknown"}`} title={game.steam_deck?.summary || "Steam Deck compatibility unknown"}>
                  <SteamDeckMark size={17} /><span className="steam-deck-label">Steam Deck</span><DeckCompatibilityIcon status={game.steam_deck?.status} size={18} />
                  <strong>{game.steam_deck?.label || "Deck compatibility unknown"}</strong>
                </span>}
              </div>
              <div className="hero-actions game-external-actions">
                  <a className="primary-button" href={game.steam_url || ("https://store.steampowered.com/app/" + game.appid + "/")} target="_blank" rel="noreferrer"><img className="external-site-icon" src="https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=64" alt="" /> Steam <ExternalLink size={14} /></a>
                  <a className="secondary-button external-site-button" href={"https://steamdb.info/app/" + game.appid + "/"} target="_blank" rel="noreferrer"><img className="external-site-icon" src="https://www.google.com/s2/favicons?domain=steamdb.info&sz=64" alt="" /> SteamDB <ExternalLink size={13} /></a>
{game.type !== "dlc" && <>
                  <a className="secondary-button external-site-button" href={"https://www.protondb.com/app/" + game.appid} target="_blank" rel="noreferrer"><img className="external-site-icon" src="https://www.google.com/s2/favicons?domain=protondb.com&sz=64" alt="" /> ProtonDB <ExternalLink size={13} /></a>
                  <a className="secondary-button external-site-button" href={"https://www.pcgamingwiki.com/api/appid.php?appid=" + game.appid} target="_blank" rel="noreferrer"><img className="external-site-icon" src="https://www.google.com/s2/favicons?domain=pcgamingwiki.com&sz=64" alt="" /> PCGamingWiki <ExternalLink size={13} /></a>
                  <a className="secondary-button external-site-button" href={"https://howlongtobeat.com/?q=" + encodeURIComponent(game.name)} target="_blank" rel="noreferrer"><img className="external-site-icon" src="https://www.google.com/s2/favicons?domain=howlongtobeat.com&sz=64" alt="" /> HowLongToBeat <ExternalLink size={13} /></a>
                  </>}
                  <button className="secondary-button share-game-button" onClick={async () => {
                    if (!shareCardRef.current) return;
                    setShareStatus("Preparing image…");
                    try {
                      const blob = await toBlob(shareCardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#0b1020" });
                      if (!blob) throw new Error("Could not generate the image.");
                      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                      setShareStatus("Image copied!");
                    } catch (error) {
                      console.error("Game card copy failed:", error);
                      setShareStatus("Clipboard unavailable");
                    }
                    window.setTimeout(() => setShareStatus(""), 2500);
                  }}><Share2 size={15} /> {shareStatus || "Share"}</button>
                  <button className="secondary-button" onClick={() => loadGame(appid)}><RefreshCw size={15} /> Refresh data</button>
                </div>
            </div>
            <div className="hero-corner">APP/{game.appid}</div>
          </section>
          <div className="share-card-render" aria-hidden="true">
            <div className="share-card-art"><img src={hero} crossOrigin="anonymous" alt="" /></div>
            <div className="share-card-content">
              <div className="share-card-brand">STEAMPULSE <span>GAME SNAPSHOT</span></div>
              <h1>{game.name}</h1>
              <p className="share-card-description">{game.short_description || "Discover this game on Steam."}</p>
              <div className="share-card-stats">
                <div><small>PRICE</small><strong>{price}</strong></div>
                <div><small>METACRITIC</small><strong>{game.metacritic?.score ?? "—"}</strong></div>
                <div><small>PLAYERS ONLINE</small><strong>{formatNumber(game.player_count)}</strong></div>
              </div>
              <div className="share-card-tags">{(game.genres || []).slice(0, 5).map((genre) => <span key={genre}>{genre}</span>)}</div>
              <div className="share-card-footer"><span>APP/{game.appid}</span><strong>STEAMPULSE · aresgame.ir</strong></div>
            </div>
          </div>

          {game.type !== "dlc" && <section className="stats-strip">
            <Strip label="CURRENT PRICE" value={price} icon={Tag} />
            <Strip label="PLAYERS ONLINE" value={formatNumber(game.player_count)} icon={Users} />
            <Strip label="METACRITIC" value={game.metacritic?.score ?? "—"} icon={Star} />
          </section>}

          {game.type === "dlc" && <section className="dlc-parent-notice detail-card"><div className="dlc-parent-icon"><Library size={22} /></div><div className="dlc-parent-copy"><span className="section-kicker">DLC · BASE GAME REQUIRED</span><h3>This content requires the base game</h3><p>This is downloadable content, not a standalone game. You need to own the base game on Steam to access it.</p>{game.parent_game?.appid ? <><div className="dlc-parent-game"><img src={game.parent_game.header_image || ("https://cdn.akamai.steamstatic.com/steam/apps/" + game.parent_game.appid + "/header.jpg")} alt="" loading="lazy" /><div className="dlc-parent-game-info"><strong>{game.parent_game.name}</strong><small>Required base game</small></div></div><div className="dlc-parent-actions"><a className="dlc-parent-action dlc-parent-steam" href={"https://store.steampowered.com/app/" + game.parent_game.appid + "/"} target="_blank" rel="noreferrer">View base game on Steam <ExternalLink size={14} /></a><a className="dlc-parent-action dlc-parent-steampulse" href={"#/game/" + game.parent_game.appid}>View base game on SteamPulse <ChevronRight size={15} /></a></div></> : <p className="dlc-parent-unknown">Check the DLC store page for its required base game.</p>}</div></section>}

          <div className="purchase-layout">
            <div className="purchase-options-column">
            {game.type !== "edition" && ((game.editions || []).length > 0 || (game.bundles || []).length > 0) && <section className="extra-content-section purchase-options-panel">
              <div className="detail-header"><div><span className="section-kicker">PURCHASE OPTIONS</span><h2>Choose your version</h2><p className="purchase-hint">Select an edition or bundle to calculate its required keys and estimated cost.</p></div></div>
              <div className="purchase-tabs" role="tablist" aria-label="Purchase options">
                <button type="button" role="tab" aria-selected={purchaseTab === "editions"} className={purchaseTab === "editions" ? "purchase-tab-active" : ""} onClick={() => setPurchaseTab("editions")}>Editions <span>{(game.editions || []).length}</span></button>
                <button type="button" role="tab" aria-selected={purchaseTab === "bundles"} className={purchaseTab === "bundles" ? "purchase-tab-active" : ""} onClick={() => setPurchaseTab("bundles")}>Bundles <span>{(game.bundles || []).length}</span></button>
              </div>
              {purchaseTab === "editions" && <div className="editions-grid purchase-editions-grid">
                {(game.editions || []).length ? game.editions.map((edition, i) => <article className={`edition-card ${selectedEditionName === (edition.name || "").replace(/\s*-\s*\\$\s*$/, "") ? "edition-card-selected" : ""}`} key={`${edition.name}-${i}`}>
                  <button className="edition-select" onClick={() => { if (edition.priceValue != null) { setRegionalPriceInput(String(edition.priceValue)); setSelectedEditionName((edition.name || "").replace(/\s*-\s*\\$\s*$/, "")); calculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }} disabled={edition.priceValue == null} title={edition.priceValue == null ? "Price unavailable for calculation" : "Calculate required keys for this option"}>
                    <div className="edition-top"><span className="edition-tag">{edition.kind || "STEAM EDITION"}</span>{edition.savings && Number(edition.savings) > 0 && <span className="edition-discount">-{edition.savings}%</span>}</div>
                    <h3>{(edition.name || "").replace(/\s*-\s*\\$\s*$/, "")}</h3><p>{edition.description || "Steam purchase option"}</p>
                    <div className="edition-bottom"><div className="edition-prices">{edition.originalPrice && edition.savings && Number(edition.savings) > 0 && <del>{edition.originalPrice}</del>}<strong>{edition.price || "Price unavailable"}</strong></div>{edition.savings && Number(edition.savings) > 0 && <span className="edition-save-label">Save {edition.savings}%</span>}</div>
                    <span className="edition-calculate">{edition.priceValue != null ? "Calculate keys" : "Price unavailable"} <ChevronRight size={13} /></span>
                  </button>{edition.url && <a className="edition-external-link" href={edition.url} target="_blank" rel="noreferrer">View on Steam <ExternalLink size={13} /></a>}
                </article>) : <div className="purchase-empty-state">No separate editions are listed for this game.</div>}
              </div>}
              {purchaseTab === "bundles" && <div className="bundle-list">
                {(game.bundles || []).length ? game.bundles.map((bundle) => <article className={`bundle-row ${selectedEditionName === (bundle.name || "").replace(/\s*-\s*\\$\s*$/, "") ? "edition-card-selected" : ""}`} key={bundle.id}>
                  <button className="bundle-select" onClick={() => { if (bundle.priceValue != null) { setRegionalPriceInput(String(bundle.priceValue)); setSelectedEditionName((bundle.name || "").replace(/\s*-\s*\\$\s*$/, "")); calculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }} disabled={bundle.priceValue == null} title={bundle.priceValue == null ? "Price unavailable for calculation" : "Calculate required keys for this bundle"}>
                    <span className={`bundle-thumb ${bundle.image ? "" : "bundle-thumb-empty"}`}>{bundle.image ? <img src={bundle.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement.classList.add("bundle-thumb-empty"); }} /> : <Tag size={18} />}</span>
                    <span className="bundle-copy"><strong>{(bundle.name || "").replace(/\s*-\s*\\$\s*$/, "")}</strong><small>{bundle.appCount ? `Includes ${bundle.appCount} games or items, including this title` : "Steam bundle featuring this title"}</small><span className="bundle-price">{bundle.originalPrice && bundle.originalPrice !== bundle.price && <del>{bundle.originalPrice}</del>}<b>{bundle.price || "Price unavailable"}</b>{bundle.savings && <em>{bundle.savings}% OFF</em>}</span></span>
                    <span className="bundle-calculate">{bundle.priceValue != null ? "Calculate keys" : "Unavailable"} <ChevronRight size={14} /></span>
                  </button><a className="bundle-store-link" href={bundle.url} target="_blank" rel="noreferrer" aria-label={`View ${bundle.name} on Steam`}><ExternalLink size={14} /></a>
                </article>) : <div className="purchase-empty-state">No Steam bundles found for this game.</div>}
              </div>}
            </section>}
            </div>
            <section className="key-calculator detail-card" ref={calculatorRef}>
              <div className="calculator-heading"><div><span className="section-kicker">KEY COST ESTIMATOR</span><h2>Calculate your key cost</h2><p>Choose the Steam region and price to estimate how many keys you need and the total cost.</p></div><div className="calculator-icon"><Tag size={21} /></div></div><label className="calculator-region"><span><Globe2 size={15} /> Steam price region</span><select value={region} onChange={(e) => { setRegion(e.target.value); localStorage.setItem("steampulse-region", e.target.value); }} aria-label="Steam price region">{REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label} ({r.code} · {r.currency})</option>)}</select></label>
              <div className="calculator-content">
                <label className="usd-price-field"><span>Steam price ({selectedRegion.currency})</span><div><span>{selectedRegion.currency}</span><input type="number" min="0" step="0.01" value={regionalPriceInput} onChange={(e) => setRegionalPriceInput(e.target.value)} placeholder="48.00" aria-label={`Steam price in ${selectedRegion.currency}`} /></div></label>
                <div className="calculator-result"><small>KEYS REQUIRED</small><strong>{keyCount ? formatNumber(keyCount) : "—"} <span>Keys</span></strong><p>{keyCount && regionalKeyPriceForCalculation > 0 ? `${keyCount} × ${formatNumber(regionalKeyPriceForCalculation)} ${selectedRegion.currency} net/key` : regionalKeyPrice?.error || "Loading live Steam key price for this region…"}</p></div>
                <div className="calculator-result cost-result"><small>ESTIMATED COST</small><strong>{keyCount ? formatNumber(totalToman) : "—"} <span>toman</span></strong><p>{keyCount && liveKeyPriceToman > 0 ? `${keyCount} × ${formatNumber(liveKeyPriceToman)} toman` : shopDataError || regionalKeyPrice?.error || "Loading live shop key price…"}</p></div>
              </div>
            </section>
          </div>

          {game.type !== "dlc" && <section className={`deck-compatibility deck-status-${game.steam_deck?.status || "unknown"}`}>
            <div className="deck-main">
              <div className="deck-icon"><SteamDeckMark size={27} /></div>
              <div className="deck-title"><span className="section-kicker">STEAM DECK COMPATIBILITY</span><h2>{game.steam_deck?.label || "Compatibility unknown"}</h2><p>{game.steam_deck?.summary || "Steam has not published a compatibility rating for this game."}</p></div>
              <div className="deck-badge"><DeckCompatibilityIcon status={game.steam_deck?.status} size={21} /><span>{game.steam_deck?.label || "Unknown"}</span></div>
            </div>
            {(game.steam_deck?.criteria || []).length > 0 && <div className="deck-criteria">{game.steam_deck.criteria.map((item, i) => <div className={`deck-criterion deck-criterion-${item.result}`} key={`${item.name}-${i}`}><span className="criterion-icon">{item.result === "pass" ? <CheckCircle2 size={15} /> : item.result === "fail" ? <CircleX size={15} /> : <CircleHelp size={15} />}</span><span>{item.name}</span><small>{item.result === "pass" ? "PASS" : item.result === "fail" ? "ISSUE" : "INFO"}</small></div>)}</div>}
            <a className="deck-report-link" href={`https://store.steampowered.com/app/${game.appid}/`} target="_blank" rel="noreferrer">View Steam Deck details on Steam <ExternalLink size={13} /></a>
          </section>}

          {(game.dlc || []).length > 0 && <section className="extra-content-section detail-card dlc-section-card"><div className="detail-header"><div><span className="section-kicker">EXPAND YOUR GAME</span><h2>Downloadable content</h2><p className="purchase-hint">Open a DLC here or view its Steam store page.</p></div><span className="section-count">{game.dlc.length}{game.dlc_total > game.dlc.length ? ` / ${game.dlc_total}` : ""} DLCs</span></div><div className="dlc-grid">{game.dlc.map((item) => <article className="dlc-card" key={item.appid}><img src={item.image || game.header_image} alt="" loading="lazy" /><div className="dlc-copy"><strong>{item.name}</strong><small>APP ID · {item.appid}</small><span>{item.price || "Price unavailable"}</span><div className="dlc-actions"><a className="dlc-open-button" href={"#/game/" + item.appid} onClick={() => loadGame(item.appid, region)}><Gamepad2 size={13} /> Show details</a><a className="dlc-store-button" href={item.url} target="_blank" rel="noreferrer">Steam <ExternalLink size={12} /></a></div></div></article>)}</div>{game.dlc.length < game.dlc_total && <div className="dlc-load-more"><p className="dlc-note">Showing {game.dlc.length} of {game.dlc_total} DLC items.</p><button type="button" className="secondary-button" onClick={loadMoreDlc} disabled={loadingMoreDlc}>{loadingMoreDlc ? <><LoaderCircle size={15} className="spin" /> Loading DLCs…</> : <><ChevronRight size={15} /> Load more DLCs</>}</button></div>}</section>}

          <section className="detail-section">
            <div className="detail-card game-intel-card"><div className="detail-header"><div><span className="section-kicker">GAME INTEL</span><h2>Inside the game</h2></div><div className="tabs">{tabNames.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div></div>
            {activeTab === "overview" && <div className="overview-grid">
              <article className="detail-card about-card"><div className="card-title"><Info size={17} /><h3>About this game</h3></div><div className="about-copy" dangerouslySetInnerHTML={{__html: game.about_the_game || game.short_description || "No description available."}} /><div className="tag-group">{(game.genres || []).map((genre) => <span className="tag" key={genre}>{genre}</span>)}</div>
                <div className="people-grid"><div><small>DEVELOPED BY</small><strong>{game.developers?.join(", ") || "Not listed"}</strong></div><div><small>PUBLISHED BY</small><strong>{game.publishers?.join(", ") || "Not listed"}</strong></div></div>
              </article>
              
            </div>}
            {activeTab === "screenshots" && <div className="screenshots-grid">{(game.screenshots || []).length ? game.screenshots.map((src, i) => <a href={src} target="_blank" rel="noreferrer" key={src} className="screenshot-card"><img src={src} loading="lazy" alt={`${game.name} screenshot ${i + 1}`} /><span><ImageIcon size={14} /> SCREENSHOT {String(i + 1).padStart(2,"0")} <ExternalLink size={13} /></span></a>) : <div className="empty-card">No screenshots are available for this title.</div>}</div>}
            {activeTab === "videos" && <div className="videos-grid">{(game.movies || []).length ? game.movies.map((movie, i) => <article className="video-card" key={`${movie.webm || movie.mp4}-${i}`}><a href={movie.mp4 || movie.webm} target="_blank" rel="noreferrer" className="video-thumb"><img src={movie.thumbnail} loading="lazy" alt="" /><span><Gamepad2 size={18} /></span></a><div className="video-copy"><strong>{movie.name || `${game.name} video ${i + 1}`}</strong><a href={movie.mp4 || movie.webm} target="_blank" rel="noreferrer">Watch video <ExternalLink size={13} /></a></div></article>) : <div className="empty-card">No videos are available for this title.</div>}</div>}
             {(activeTab === "steam news" || activeTab === "external news") && (() => {
              const isSteamNews = activeTab === "steam news";
              const items = isSteamNews ? (game.news || []) : (game.external_news || []);
              return <div className="game-news-grid">{items.length ? items.map((item, i) => <article className="game-news-card" key={item.gid || i}>
                {isSteamNews && (item.image || game.header_image || game.header_image_2x || hero) && <a className="game-news-image" href={item.url} target="_blank" rel="noreferrer"><img src={item.image || game.header_image || game.header_image_2x || hero} loading="lazy" alt={item.image ? "" : game.name} /></a>}
                <div className="game-news-body"><div className="game-news-meta"><span>{item.feedlabel || (isSteamNews ? "STEAM NEWS" : "EXTERNAL NEWS")}</span><time>{item.date ? new Date(item.date * 1000).toLocaleDateString() : ""}</time></div><h3>{item.title}</h3><p>{item.contents || "Open the article to read the full update."}</p><a href={item.url} target="_blank" rel="noreferrer">{isSteamNews ? "Read on Steam" : "Read article"} <ExternalLink size={13} /></a></div>
              </article>) : <div className="empty-card">No recent {isSteamNews ? "Steam" : "external"} news is available for this title.</div>}</div>;
            })()}
             {activeTab === "requirements" && <div className="detail-card requirements-card"><div className="card-title"><Monitor size={17} /><h3>PC system requirements</h3></div>{game.pc_requirements?.minimum ? <div className="requirements-copy" dangerouslySetInnerHTML={{__html: game.pc_requirements.minimum}} /> : <p>Steam has not provided minimum PC requirements for this title.</p>}{game.pc_requirements?.recommended && <><h4>Recommended</h4><div className="requirements-copy" dangerouslySetInnerHTML={{__html: game.pc_requirements.recommended.replace(/^\s*(?:<h[1-6][^>]*>\s*Recommended\s*<\/h[1-6]>|<(?:strong|b)[^>]*>\s*Recommended\s*:?\s*<\/(?:strong|b)>|Recommended\s*:?)(?:\s|&nbsp;|<br\s*\/?>)*/i, "")}} /></>}</div>}
            </div>
          </section>
          <footer className="page-footer"><span>STEAMPULSE</span><span>APP/{game.appid}</span></footer>
        </>}
      </main>
      <footer className="site-footer">
        <span>© All rights reserved</span>
        <span className="site-footer-credit">Made with <span aria-label="love">❤️</span> by <img src="https://codemage.ir/img/favicon.png" alt="CodeMage" loading="lazy" /><a href="https://codemage.ir/" target="_blank" rel="noreferrer">CodeMage</a></span>
      </footer>
    </div>
  );
}
