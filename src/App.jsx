import { useEffect, useRef, useState } from "react";
import {
  Search, Gamepad2, Activity, CalendarDays, ExternalLink, Monitor, Apple,
  Star, Users, Tag, ChevronRight, LoaderCircle, X, RefreshCw, Globe2, Gift,
  Sparkles, Image as ImageIcon, Info, CheckCircle2, AlertTriangle, CircleHelp, CircleX
} from "lucide-react";

const REGIONS = [
  { code: "US", label: "United States", currency: "USD", usdRate: 1 },
  { code: "GB", label: "United Kingdom", currency: "GBP", usdRate: 0.79 },
  { code: "DE", label: "Germany", currency: "EUR", usdRate: 0.92 },
  { code: "TR", label: "Türkiye", currency: "TRY", usdRate: 42 },
  { code: "AR", label: "Argentina", currency: "ARS", usdRate: 1450 },
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
  const [region, setRegion] = useState("US");
  const [currentPage, setCurrentPage] = useState(() => { const match = window.location.hash.match(/^#\/game\/(\d+)/); return match ? "game" : (window.location.hash.match(/^#\/(home|games|trending)$/)?.[1] || "home"); });
  const [query, setQuery] = useState("");
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
  const [discovery, setDiscovery] = useState({ newReleases: [], upcoming: [], topSellers: [] });
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryTab, setDiscoveryTab] = useState("trending");
  const [freeGames, setFreeGames] = useState([]);
  const [freeGamesLoading, setFreeGamesLoading] = useState(true);
  const [freeGamesError, setFreeGamesError] = useState("");
  const calculatorRef = useRef(null);
  const searchRef = useRef(null);
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
    setLoading(true);
    setError("");
    setSearchOpen(false);
    // Hide the previous game's details immediately so stale art never remains visible.
    setGame(null);
    setRegionalPriceInput("");
    setSelectedEditionName("");
    try {
      const response = await fetch(`/api/game/${id}?cc=${cc}`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || data.detail || "Unable to load this game.");
      setGame(data);
      // Bundle discovery can be slow on some Steam pages; load it after the main game details.
      fetch(`/api/game/${id}/bundles?cc=${cc}`)
        .then((response) => response.ok ? response.json() : null)
        .then((bundleData) => {
          if (!bundleData || !Array.isArray(bundleData.bundles)) return;
          setGame((current) => String(current?.appid) === String(id) && String(region) === String(cc)
            ? { ...current, bundles: bundleData.bundles }
            : current);
        })
        .catch(() => {});
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
      const pageMatch = hash.match(/^#\/(home|games|trending)$/);
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
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (game) loadGame(appid, region);
  }, [region]);

  useEffect(() => {
    let cancelled = false;
    setDiscoveryLoading(true);
    setDiscoveryError("");
    fetch(`/api/discover?cc=${region}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load game discovery.");
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
  const regionalKeyPrice = 1.85 * selectedRegion.usdRate;
  const keyCount = regionalPriceInput.trim() !== "" && Number.isFinite(numericRegionalPrice) && numericRegionalPrice > 0 ? Math.ceil(numericRegionalPrice / regionalKeyPrice) : 0;
  const totalToman = keyCount * 480000;
  const systemNames = Object.entries(game?.platforms || {}).filter(([, supported]) => supported).map(([name]) => name);
  const tabNames = ["overview", "screenshots", "requirements"];

  return (
    <div className="app-shell" style={game?.background ? { backgroundImage: `linear-gradient(180deg, rgba(8,13,27,.84) 0%, rgba(8,13,27,.94) 34rem, #080d1b 85%), url("${game.background}")` } : undefined}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark"><Activity size={23} strokeWidth={2.5} /></span>
          <span>STEAM<span className="brand-accent">PULSE</span><small>GAME INTELLIGENCE</small></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">{[["home","Home"],["games","Games"],["trending","Trending"]].map(([page,label]) => <button key={page} className={currentPage === page ? "active" : ""} onClick={() => navigateTo(page)}>{page === "home" ? <Activity size={15} /> : page === "games" ? <Gamepad2 size={15} /> : <Sparkles size={15} />}{label}</button>)}</nav>
        <div className="topbar-right"><span className="online-pill"><span className="status-dot" /> API READY</span><span className="avatar">SP</span></div>
      </header>

      <main className="main-content">
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
          <div className="popular-line"><span>TRY A QUICK LOOK</span>{[{ name:"Cyberpunk 2077",id:"1091500"},{name:"Elden Ring",id:"1245620"},{name:"Baldur's Gate 3",id:"1086940"},{name:"Hades II",id:"1145350"}].map((g) => <button key={g.id} onClick={() => {setQuery(g.name);loadGame(g.id);}}>{g.name}</button>)}</div>
        </section>
        </>}

        {currentPage === "trending" && <>
        <section className="discovery-section">
          <div className="discovery-heading">
            <div><span className="section-kicker"><Sparkles size={13} /> STEAM RADAR</span><h2>What’s hot right now</h2><p>Fresh releases, upcoming launches, and games players are buying.</p></div>
            <button className="discovery-refresh" onClick={() => {
              setDiscoveryLoading(true); setDiscoveryError("");
              fetch(`/api/discover?cc=${region}&refresh=1`)
                .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Refresh failed."); return data; })
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
              {(discoveryTab === "new" ? discovery.newReleases : discoveryTab === "upcoming" ? discovery.upcoming : discovery.topSellers).slice(0, 8).map((item) => <button className="discovery-card" key={item.id} onClick={() => { setQuery(item.name); setInputId(String(item.id)); loadGame(item.id, region); }}>
                <span className="discovery-image-wrap"><img src={item.image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`} alt="" loading="lazy" /><span className="discovery-badge">{item.badge}</span></span>
                <span className="discovery-card-copy"><strong>{item.name}</strong><span className="discovery-card-meta">{item.releaseDate || item.subtitle || "Steam game"}{item.price ? <b>{item.price}</b> : null}</span></span>
              </button>)}
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
                    <button className="free-game-main" onClick={() => { setQuery(item.name); setInputId(String(item.id)); loadGame(item.id, region); }}>
                      <span className="discovery-image-wrap"><img src={item.image} alt="" loading="lazy" /><span className="discovery-badge">{item.offerType}</span></span>
                      <span className="discovery-card-copy"><strong>{item.name}</strong><span className="discovery-card-meta">Expires {item.expires || "soon"}</span></span>
                    </button>
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
            {game?.game_logo && <div className="hero-game-logo"><img src={game.game_logo} alt={`${game.name} logo`} onError={(event) => { event.currentTarget.parentElement.style.display = "none"; }} /></div>}
            <div className="hero-content">
              <div className="hero-topline"><span className="game-label"><Gamepad2 size={13} /> STEAM TITLE</span><span className="app-tag">APP/{game.appid}</span></div>
              <h2>{game.name}</h2><p className="hero-description">{game.short_description || "No short description is available for this title."}</p>
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
              <div className="hero-actions"><a className="primary-button" href={game.steam_url} target="_blank" rel="noreferrer">View on Steam <ExternalLink size={15} /></a><button className="secondary-button" onClick={() => loadGame(appid)}><RefreshCw size={15} /> Refresh data</button></div>
            </div>
            <div className="hero-corner">STEAMPULSE <span>01 / GAME PROFILE</span></div>
          </section>

          <section className="stats-strip">
            <Strip label="CURRENT PRICE" value={price} icon={Tag} />
            <Strip label="PLAYERS ONLINE" value={formatNumber(game.player_count)} icon={Users} />
            <Strip label="METACRITIC" value={game.metacritic?.score ?? "—"} icon={Star} />
            <Strip label="RECOMMENDATIONS" value={formatNumber(game.recommendations)} icon={Activity} />
            <div className="region-select"><Globe2 size={16} /><select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Price region">{REGIONS.map((r) => <option key={r.code} value={r.code}>{r.code} · {r.currency}</option>)}</select></div>
          </section>

          {game.type !== "dlc" && <section className={`deck-compatibility deck-status-${game.steam_deck?.status || "unknown"}`}>
            <div className="deck-main">
              <div className="deck-icon"><SteamDeckMark size={27} /></div>
              <div className="deck-title"><span className="section-kicker">STEAM DECK COMPATIBILITY</span><h2>{game.steam_deck?.label || "Compatibility unknown"}</h2><p>{game.steam_deck?.summary || "Steam has not published a compatibility rating for this game."}</p></div>
              <div className="deck-badge"><DeckCompatibilityIcon status={game.steam_deck?.status} size={21} /><span>{game.steam_deck?.label || "Unknown"}</span></div>
            </div>
            {(game.steam_deck?.criteria || []).length > 0 && <div className="deck-criteria">{game.steam_deck.criteria.map((item, i) => <div className={`deck-criterion deck-criterion-${item.result}`} key={`${item.name}-${i}`}><span className="criterion-icon">{item.result === "pass" ? <CheckCircle2 size={15} /> : item.result === "fail" ? <CircleX size={15} /> : <CircleHelp size={15} />}</span><span>{item.name}</span><small>{item.result === "pass" ? "PASS" : item.result === "fail" ? "ISSUE" : "INFO"}</small></div>)}</div>}
            <a className="deck-report-link" href={`https://store.steampowered.com/app/${game.appid}/`} target="_blank" rel="noreferrer">View Steam Deck details on Steam <ExternalLink size={13} /></a>
          </section>}

          <section className="key-calculator detail-card" ref={calculatorRef}>
            <div className="calculator-heading"><div><span className="section-kicker">KEY COST ESTIMATOR</span><h2>Required keys &amp; estimated cost</h2><p>Uses the selected region\u2019s Steam price and an estimated local equivalent of $1.85 per key. You can edit the price manually.</p></div><div className="calculator-icon"><Tag size={21} /></div></div>
            <div className="calculator-content">
              <label className="usd-price-field"><span>Steam price ({selectedRegion.currency})</span><div><span>{selectedRegion.currency}</span><input type="number" min="0" step="0.01" value={regionalPriceInput} onChange={(e) => setRegionalPriceInput(e.target.value)} placeholder="48.00" aria-label={`Steam price in ${selectedRegion.currency}`} /></div></label>
              <div className="calculator-result"><small>KEYS REQUIRED</small><strong>{keyCount ? formatNumber(keyCount) : "—"} <span>Keys</span></strong><p>Round up to the next whole key</p></div>
              <div className="calculator-result cost-result"><small>ESTIMATED COST</small><strong>{keyCount ? formatNumber(totalToman) : "—"} <span>toman</span></strong><p>{keyCount ? `${keyCount} × 480,000 toman` : "Enter a USD price to calculate"}</p></div>
            </div>
          </section>

          {(game.editions || []).length > 0 && <section className="extra-content-section"><div className="detail-header"><div><span className="section-kicker">PURCHASE OPTIONS</span><h2>Editions &amp; bundles</h2><p className="purchase-hint">Select an edition or bundle to calculate its required keys and estimated cost.</p></div><span className="section-count">{game.editions.length} OPTIONS</span></div><div className="editions-grid">{game.editions.map((edition, i) => <article className={`edition-card ${selectedEditionName === edition.name ? "edition-card-selected" : ""}`} key={`${edition.name}-${i}`}><button className="edition-select" onClick={() => { if (edition.priceValue != null) { setRegionalPriceInput(String(edition.priceValue)); setSelectedEditionName(edition.name); calculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }} disabled={edition.priceValue == null} title={edition.priceValue == null ? "Price unavailable for calculation" : "Calculate required keys for this option"}><div className="edition-top"><span className="edition-icon"><Tag size={16} /></span><span className="edition-tag">{edition.kind || "BUNDLE / EDITION"}</span></div><h3>{edition.name}</h3><p>{edition.description || "Steam purchase option"}</p><div className="edition-bottom"><strong>{edition.price || "Price unavailable"}</strong>{edition.savings && <span>{edition.savings} OFF</span>}</div><span className="edition-calculate">{edition.priceValue != null ? "Calculate keys" : "Price unavailable"} <ChevronRight size={13} /></span></button>{edition.url && <a className="edition-external-link" href={edition.url} target="_blank" rel="noreferrer">View on Steam <ExternalLink size={13} /></a>}</article>)}</div></section>}

          {(game.bundles || []).length > 0 && <section className="extra-content-section"><div className="detail-header"><div><span className="section-kicker">STEAM STORE BUNDLES</span><h2>Bundles featuring this game</h2><p className="purchase-hint">Bundles listed on the Steam store page that include this game. Select one to estimate its key cost.</p></div><span className="section-count">{game.bundles.length} BUNDLES</span></div><div className="editions-grid">{game.bundles.map((bundle) => <article className={`edition-card ${selectedEditionName === bundle.name ? "edition-card-selected" : ""}`} key={bundle.id}><button className="edition-select" onClick={() => { if (bundle.priceValue != null) { setRegionalPriceInput(String(bundle.priceValue)); setSelectedEditionName(bundle.name); calculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }} disabled={bundle.priceValue == null} title={bundle.priceValue == null ? "Price unavailable for calculation" : "Calculate required keys for this bundle"}><div className="edition-top"><span className="edition-icon"><Tag size={16} /></span><span className="edition-tag">STEAM BUNDLE</span></div><h3>{bundle.name}</h3><p>{bundle.appCount ? `Includes ${bundle.appCount} games or items, including this title.` : "Steam bundle featuring this title."}</p><div className="edition-bottom"><strong>{bundle.price || "Price unavailable"}</strong>{bundle.savings && <span>{bundle.savings}% OFF</span>}</div><span className="edition-calculate">{bundle.priceValue != null ? "Calculate keys" : "Price unavailable"} <ChevronRight size={13} /></span></button><a className="edition-external-link" href={bundle.url} target="_blank" rel="noreferrer">View bundle on Steam <ExternalLink size={13} /></a></article>)}</div></section>}

          {(game.dlc || []).length > 0 && <section className="extra-content-section"><div className="detail-header"><div><span className="section-kicker">EXPAND YOUR GAME</span><h2>Downloadable content</h2><p className="purchase-hint">Open a DLC here or view its Steam store page.</p></div><span className="section-count">{game.dlc.length}{game.dlc_total > game.dlc.length ? ` / ${game.dlc_total}` : ""} DLCs</span></div><div className="dlc-grid">{game.dlc.map((item) => <article className="dlc-card" key={item.appid}><img src={item.image || game.header_image} alt="" loading="lazy" /><div className="dlc-copy"><strong>{item.name}</strong><small>APP ID · {item.appid}</small><span>{item.price || "Price unavailable"}</span><div className="dlc-actions"><button type="button" className="dlc-open-button" onClick={() => loadGame(item.appid, region)}><Gamepad2 size={13} /> Show details</button><a className="dlc-store-button" href={item.url} target="_blank" rel="noreferrer">Steam <ExternalLink size={12} /></a></div></div></article>)}</div>{game.dlc.length < game.dlc_total && <div className="dlc-load-more"><p className="dlc-note">Showing {game.dlc.length} of {game.dlc_total} DLC items.</p><button type="button" className="secondary-button" onClick={loadMoreDlc} disabled={loadingMoreDlc}>{loadingMoreDlc ? <><LoaderCircle size={15} className="spin" /> Loading DLCs…</> : <><ChevronRight size={15} /> Load more DLCs</>}</button></div>}</section>}

          <section className="detail-section">
            <div className="detail-header"><div><span className="section-kicker">GAME INTEL</span><h2>Inside the game</h2></div><div className="tabs">{tabNames.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div></div>
            {activeTab === "overview" && <div className="overview-grid">
              <article className="detail-card about-card"><div className="card-title"><Info size={17} /><h3>About this game</h3></div><div className="about-copy" dangerouslySetInnerHTML={{__html: game.about_the_game || game.short_description || "No description available."}} /><div className="tag-group">{(game.genres || []).map((genre) => <span className="tag" key={genre}>{genre}</span>)}</div>
                <div className="people-grid"><div><small>DEVELOPED BY</small><strong>{game.developers?.join(", ") || "Not listed"}</strong></div><div><small>PUBLISHED BY</small><strong>{game.publishers?.join(", ") || "Not listed"}</strong></div></div>
              </article>
              <article className="detail-card"><div className="card-title"><Activity size={17} /><h3>Game profile</h3></div><div className="info-list"><div><span>Release date</span><strong>{game.release_date || "Unknown"}</strong></div><div><span>Genre</span><strong>{game.genres?.join(", ") || "Not listed"}</strong></div><div><span>Supported OS</span><strong>{systemNames.join(", ") || "Not listed"}</strong></div><div><span>Store categories</span><strong>{game.categories?.slice(0, 5).join(", ") || "Not listed"}</strong></div><div><span>Price region</span><strong>{REGIONS.find((r) => r.code === region)?.label || region}</strong></div></div></article>
            </div>}
            {activeTab === "screenshots" && <div className="screenshots-grid">{(game.screenshots || []).length ? game.screenshots.map((src, i) => <a href={src} target="_blank" rel="noreferrer" key={src} className="screenshot-card"><img src={src} loading="lazy" alt={`${game.name} screenshot ${i + 1}`} /><span><ImageIcon size={14} /> SCREENSHOT {String(i + 1).padStart(2,"0")} <ExternalLink size={13} /></span></a>) : <div className="empty-card">No screenshots are available for this title.</div>}</div>}
            {activeTab === "requirements" && <div className="detail-card requirements-card"><div className="card-title"><Monitor size={17} /><h3>PC system requirements</h3></div>{game.pc_requirements?.minimum ? <div className="requirements-copy" dangerouslySetInnerHTML={{__html: game.pc_requirements.minimum}} /> : <p>Steam has not provided minimum PC requirements for this title.</p>}{game.pc_requirements?.recommended && <><h4>Recommended</h4><div className="requirements-copy" dangerouslySetInnerHTML={{__html: game.pc_requirements.recommended}} /></>}</div>}
          </section>
          <footer className="page-footer"><span>STEAMPULSE <b>·</b> GAME INTELLIGENCE</span><span>DATA PROVIDED BY STEAM STORE <span className="status-dot" /></span></footer>
        </>}
      </main>
    </div>
  );
}
