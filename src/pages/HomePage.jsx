import { ChevronRight, LoaderCircle, Search, Sparkles, X } from "lucide-react";
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
  setRegion ,
  loading
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

    </>
  );
}
