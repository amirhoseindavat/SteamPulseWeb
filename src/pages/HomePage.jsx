import { ChevronRight, ExternalLink, Gamepad2, Gift, Info, LoaderCircle, RefreshCw, Search, Sparkles, X } from "lucide-react";
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
  region,
  setRegion,
  freeGames,
  loading,
  freeGamesLoading,
  setFreeGamesLoading,
  freeGamesError,
  setFreeGamesError,
  setFreeGames
}) {
  return (
    <>
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
                {results.slice(0, 8).map((item) => <a className="result-row" key={item.id} href={`#/game/${item.id}`} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); chooseGame(item); }}>
                  <img src={item.tiny_image} alt="" loading="lazy" />
                  <span className="result-name">{item.name}<small>APP ID · {item.id}</small></span>
                  <span className="result-type">{item.type || "game"}</span><ChevronRight size={16} />
                </a>)}
              </div>}
              {searchOpen && !searching && query.trim().length >= 2 && results.length === 0 && <div className="search-results empty-results">No matches yet. Try another title or enter an AppID.</div>}
            </div>
            <button className="primary-button" onClick={() => /^\d+$/.test(query.trim()) ? loadGame(query.trim()) : results[0] ? chooseGame(results[0]) : searchGames(query)}><Search size={17} /> Search</button>
            <div className="game-region-box"><label>REGION</label><RegionSelect value={region} onChange={(nextRegion) => { setRegion(nextRegion); localStorage.setItem("steampulse-region", nextRegion); }} ariaLabel="Game price region" /></div>
          </div>
          {currentPage === "home" && <div className="home-top-sellers">
            <span className="section-kicker">TOP SELLERS</span>
          </div>}
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
      {currentPage === "home" && !loading && <section className="welcome-panel"><Sparkles size={28} /><h2>Your next favorite game is out there</h2><p>Search the Steam catalog or open Trending to discover what’s hot and what’s free right now.</p></section>}

    </>
  );
}
