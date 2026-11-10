import { ChevronRight, LoaderCircle, Search, Sparkles, X, TrendingUp, ArrowUpRight } from "lucide-react";
import RegionSelect from "../components/RegionSelect";

export default function HomePage({
  currentPage,
  query,
  onSearchChange,
  searchRef,
  searchOpen,
  setSearchOpen,
  searching,
  results,
  setQuery,
  setResults,
  loadGame,
  chooseGame,
  searchGames,
  inputId,
  setInputId,
  discovery,
  discoveryLoading,
  discoveryError,
  topSellersLoading,
  storeTakeover,
  region,
  setRegion,
  loading
}) {
  const topSellers = (discovery?.topSellers || []).slice(0, 7);

  function openTopSeller(item) {
    setQuery(item.name);
    setInputId(String(item.id));
    loadGame(item.id, region);
  }

  return (
    <>

        {currentPage === "home" && storeTakeover?.image && storeTakeover?.link && <a
          className="steam-store-takeover"
          href={storeTakeover.link}
          target="_blank"
          rel="noreferrer"
          aria-label={storeTakeover.title || "Steam Store Takeover"}
        >
          {storeTakeover.mediaType === "video"
            ? <video src={storeTakeover.image} autoPlay muted loop playsInline aria-label={storeTakeover.title || "Steam Store Takeover"} />
            : <img src={storeTakeover.image} alt={storeTakeover.title || "Steam Store Takeover"} loading="eager" />}
        </a>}

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
                    if (/^\\d+$/.test(query.trim())) loadGame(query.trim());
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
                {results.slice(0, 8).map((item) => <a className="result-row" key={item.id} href={`#/game/${item.id}`} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); chooseGame(item); }}>
                  <img src={item.tiny_image} alt="" loading="lazy" />
                  <span className="result-name">{item.name}<small>APP ID · {item.id}</small></span>
                  <span className="result-type">{item.type || "game"}</span><ChevronRight size={16} />
                </a>)}
              </div>}
              {searchOpen && !searching && query.trim().length >= 2 && results.length === 0 && <div className="search-results empty-results">No matches yet. Try another title or enter an AppID.</div>}
            </div>
            <button className="primary-button" onClick={() => /^\\d+$/.test(query.trim()) ? loadGame(query.trim()) : results[0] ? chooseGame(results[0]) : searchGames(query)}><Search size={17} /> Search</button>
            <div className="game-region-box"><label>REGION</label><RegionSelect value={region} onChange={(nextRegion) => { setRegion(nextRegion); localStorage.setItem("steampulse-region", nextRegion); }} ariaLabel="Game price region" /></div>
          </div>
          {currentPage === "home" && <section className="home-top-sellers">
            <div className="home-top-sellers-heading">
              <div><span className="section-kicker"><TrendingUp size={13} /> TOP SELLERS</span><strong>Trending by revenue on Steam</strong></div>
              <a href="#/games/topsellers" aria-label="View all Top Sellers">VIEW ALL <ArrowUpRight size={13} /></a>
            </div>
            {(topSellersLoading || discoveryLoading) && !topSellers.length
              ? <div className="home-top-sellers-empty"><LoaderCircle size={15} className="spin" /> Loading Steam Top Sellers…</div>
              : topSellers.length
                ? <div className="popular-line home-top-sellers-list">
                    {topSellers.map((item) => <a
                      className="home-top-seller-name"
                      key={item.id}
                      href={`#/game/${item.id}`}
                      onClick={(event) => {
                        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        openTopSeller(item);
                      }}
                    >{item.name}</a>)}
                  </div>
                : <div className="home-top-sellers-empty">
                    {discoveryError || "Steam Top Sellers are temporarily unavailable."}
                  </div>}
          </section>}
        </section>

    </>
  );
}
