import { useEffect, useRef, useState } from "react";
import {
  Search, Gamepad2, Activity, CalendarDays, ExternalLink, Monitor,
  Star, Users, Tag, ChevronRight, LoaderCircle, X, RefreshCw, Globe2,
  Sparkles, Image as ImageIcon, Info
} from "lucide-react";

const REGIONS = [
  { code: "US", label: "United States", currency: "USD" },
  { code: "GB", label: "United Kingdom", currency: "GBP" },
  { code: "DE", label: "Germany", currency: "EUR" },
  { code: "TR", label: "Türkiye", currency: "TRY" },
  { code: "AR", label: "Argentina", currency: "ARS" },
  { code: "PL", label: "Poland", currency: "PLN" },
  { code: "IN", label: "India", currency: "INR" },
  { code: "BR", label: "Brazil", currency: "BRL" }
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
function Strip({ label, value, icon: Icon }) {
  return <div className="strip-item"><span className="strip-icon"><Icon size={16} /></span><span><small>{label}</small><strong>{value || "—"}</strong></span></div>;
}

export default function App() {
  const [region, setRegion] = useState("US");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [appid, setAppid] = useState("");
  const [inputId, setInputId] = useState("");
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

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
    setLoading(true);
    setError("");
    setSearchOpen(false);
    try {
      const response = await fetch(`/api/game/${id}?cc=${cc}`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || data.detail || "Unable to load this game.");
      setGame(data);
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
    if (game && region !== "US") loadGame(appid, region);
  }, [region]);

  const hero = game?.library_hero || game?.header_image;
  const price = money(game?.price_overview);
  const systemNames = Object.entries(game?.platforms || {}).filter(([, supported]) => supported).map(([name]) => name);
  const tabNames = ["overview", "screenshots", "requirements"];

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark"><Activity size={23} strokeWidth={2.5} /></span>
          <span>STEAM<span className="brand-accent">PULSE</span><small>GAME INTELLIGENCE</small></span>
        </a>
        <div className="topbar-center"><span className="status-dot" /> STEAM STORE DATA <span className="topbar-divider">/</span> LIVE DASHBOARD</div>
        <div className="topbar-right"><span className="online-pill"><span className="status-dot" /> API READY</span><span className="avatar">SP</span></div>
      </header>

      <main className="main-content">
        <section className="intro">
          <div className="eyebrow"><Sparkles size={14} /> YOUR STEAM COMMAND CENTER</div>
          <h1>Every game.<br /><span>One pulse.</span></h1>
          <p>Explore game data, pricing, player activity and visual details from the Steam Store.</p>
        </section>

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

        {error && <div className="error-banner"><Info size={18} /><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}
        {loading && <div className="loading-panel"><LoaderCircle className="spin" size={26} /><span>Syncing game data from Steam…</span></div>}

        {!game && !loading && <section className="welcome-panel"><Gamepad2 size={36} /><h2>Ready when you are</h2><p>Search for a game above to pull its Steam Store details.</p></section>}

        {game && <>
          <section className="game-hero">
            <div className="hero-art" style={{backgroundImage: hero ? `linear-gradient(90deg, rgba(8,13,27,.98) 0%, rgba(8,13,27,.83) 43%, rgba(8,13,27,.2) 100%), url("${hero}")` : "linear-gradient(120deg,#172541,#111827)"}} />
            <div className="hero-content">
              <div className="hero-topline"><span className="game-label"><Gamepad2 size={13} /> STEAM TITLE</span><span className="app-tag">APP/{game.appid}</span></div>
              <h2>{game.name}</h2><p className="hero-description">{game.short_description || "No short description is available for this title."}</p>
              <div className="hero-meta"><span><CalendarDays size={15} /> {game.release_date || "Release date unknown"}</span><span><Monitor size={15} /> {systemNames.join(" · ") || "Platform data unavailable"}</span></div>
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
