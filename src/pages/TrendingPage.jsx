import { ChevronRight, ExternalLink, Gift, Info, LoaderCircle, RefreshCw, Gamepad2 } from "lucide-react";

export default function TrendingPage({
  discovery,
  discoveryLoading,
  discoveryError,
  activeSection,
  onNavigateSection,
  setDiscoveryLoading,
  setDiscoveryError,
  setDiscovery,
  readApiResponse,
  region,
  setQuery,
  setInputId,
  loadGame,
  freeGames,
  freeGamesLoading,
  setFreeGamesLoading,
  freeGamesError,
  setFreeGamesError,
  setFreeGames
}) {
  const sections = [
    ["freeGames", "Free Games", "FreeGames"],
    ["topSellers", "Top Sellers", "TopSellers"],
    ["upcoming", "Coming Soon", "ComingSoon"],
    ["newReleases", "New Releases", "NewReleases"],
    ["preorders", "Preorders", "Preorders"]
  ];
  const items = activeSection === "freeGames"
    ? []
    : activeSection === "newReleases"
    ? discovery.newReleases
    : activeSection === "upcoming"
      ? discovery.upcoming
      : activeSection === "preorders"
        ? discovery.preorders
        : discovery.topSellers;
  const visibleItems = (items || []).filter((item) =>
    activeSection !== "topSellers" ||
    Number(item.priceValue) > 0 ||
    (item.priceValue == null && !/\bfree\b/i.test(String(item.price || "")) && String(item.price || "").trim() !== "")
  );

  function openGame(item) {
    setQuery(item.name);
    setInputId(String(item.id));
    loadGame(item.id, region);
  }

  function getReleaseCountdown(releaseDate) {
    const value = String(releaseDate || "").trim();
    if (!value) return null;

    // Support ISO dates and Steam's common "Nov 10, 2026" / "10 Nov, 2026" labels.
    const iso = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    const monthFirst = value.match(/([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i);
    const dayFirst = value.match(/(\d{1,2})\s+([a-z]{3,9}),?\s+(\d{4})/i);
    let year, month, day;

    if (iso) {
      [, year, month, day] = iso;
    } else {
      const match = monthFirst || dayFirst;
      if (match) {
        const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
        const monthText = (monthFirst ? match[1] : match[2]).slice(0, 3).toLowerCase();
        month = monthNames.indexOf(monthText) + 1;
        day = monthFirst ? match[2] : match[1];
        year = match[3];
      } else {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        year = parsed.getFullYear();
        month = parsed.getMonth() + 1;
        day = parsed.getDate();
      }
    }

    const releaseTime = Date.UTC(Number(year), Number(month) - 1, Number(day));
    const releaseDateValue = new Date(releaseTime);
    if (!Number.isFinite(releaseTime) || releaseDateValue.getUTCFullYear() !== Number(year) ||
        releaseDateValue.getUTCMonth() + 1 !== Number(month) || releaseDateValue.getUTCDate() !== Number(day)) return null;

    const now = new Date();
    const todayTime = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((releaseTime - todayTime) / 86400000);
    if (days < 0) return null;
    return days === 0 ? "Today" : `${days} days`;
  }

  return (
    <section className="discovery-section">
      <div className="discovery-heading">
        <div><span className="section-kicker"><Gamepad2 size={13} /> GAME LIBRARY</span><h2>Explore Steam games</h2><p>Browse best sellers, upcoming launches, fresh releases and preorders.</p></div>
        {activeSection !== "freeGames" && <button className="discovery-refresh" onClick={() => {
          setDiscoveryLoading(true); setDiscoveryError("");
          fetch(`/api/discover?cc=${region}&refresh=1`)
            .then(async (response) => { const data = await readApiResponse(response); if (!response.ok) throw new Error(data.error || data.detail || "Refresh failed."); return data; })
            .then((data) => setDiscovery({ newReleases: data.newReleases || [], upcoming: data.upcoming || [], preorders: data.preorders || [], preordersError: data.preordersError || "", topSellers: data.topSellers || [] }))
            .catch((e) => setDiscoveryError(e.message || "Refresh failed."))
            .finally(() => setDiscoveryLoading(false));
        }} disabled={discoveryLoading}><RefreshCw size={14} className={discoveryLoading ? "spin" : ""} /> Refresh</button>}
      </div>
     <nav className="discovery-tabs" aria-label="Game categories">
        {sections.map(([key, label, slug]) => <a
          key={key}
          className={activeSection === key ? "active" : ""}
          href={`/games/${slug.toLowerCase()}`}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onNavigateSection(key);
          }}
        >{label}</a>)}
      </nav>
      {activeSection === "freeGames" ? <section className="free-games-section">
        <div className="free-games-intro">
          <div><span className="section-kicker"><Gift size={13} /> FREE GAME ALERT</span><h2>Free right now</h2><p>Limited-time free offers for full games and DLC. Claim them before they expire.</p></div>
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
            ? <div className="discovery-grid free-games-grid">
                {freeGames.map((item) => <article className="free-game-card" key={item.id}>
                  <a className="free-game-main" href={`#/game/${item.id}`} onClick={() => {
                    setQuery(item.name); setInputId(String(item.id)); loadGame(item.id, region);
                  }}>
                    <span className="discovery-image-wrap"><img src={item.image} alt="" loading="lazy" /><span className="discovery-badge">{item.productType === "dlc" ? `DLC · ${item.offerType}` : item.offerType}</span></span>
                    <span className="discovery-card-copy"><strong>{item.name}</strong><span className="discovery-card-meta">{item.originalPrice ? <><s>{item.originalPrice}</s> <b>{item.currentPrice || "Free"}</b></> : "Limited-time offer · confirm on Steam"}</span></span>
                  </a>
                  <a className="free-game-claim" href={item.url} target="_blank" rel="noreferrer">Claim on Steam <ExternalLink size={12} /></a>
                </article>)}
              </div>
            : !freeGamesError && <div className="discovery-message">No active free game or DLC offers found right now. Check again later!</div>}
        <div className="discovery-sources"><span>Promotion data:</span><a href="https://steamdb.info/upcoming/free/" target="_blank" rel="noreferrer">SteamDB free promotions <ExternalLink size={11} /></a></div>
        <div className="discovery-footnote">Includes limited-time game and DLC promotions. Permanently free-to-play titles and hardware are excluded.</div>
      </section> : <>
      {activeSection !== "freeGames" && discoveryError && <div className="discovery-message"><Info size={15} />{discoveryError}</div>}
      {activeSection !== "freeGames" && discoveryLoading && !discovery.newReleases.length && !discovery.upcoming.length && !discovery.preorders.length && !discovery.topSellers.length
        ? <div className="discovery-loading"><LoaderCircle size={20} className="spin" />Finding games worth your attention…</div>
        : <div className="discovery-grid">
          {visibleItems.slice(0, activeSection === "topSellers" ? 20 : undefined).map((item, index) => activeSection === "preorders"
            ? <article className="discovery-card preorder-discovery-card" key={item.id}>
                <span className="discovery-image-wrap"><img src={item.image || ""} alt="" loading="lazy" />{item.releaseDate && <span className="discovery-badge preorder-countdown-badge">{getReleaseCountdown(item.releaseDate) || "Coming soon"}</span>}</span>
                <span className="discovery-card-copy">
                  <strong>{item.name}</strong>
                  {item.releaseDate && <span className="discovery-card-meta preorder-release-meta">{item.releaseDate}</span>}
                  <a className="preorder-open-button" href={`#/game/${item.id}`} onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    openGame(item);
                  }}>View in SteamPulse <ChevronRight size={13} /></a>
                </span>
              </article>
            : <a className="discovery-card" key={item.id} href={`#/game/${item.id}`} onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                openGame(item);
              }}>
                <span className="discovery-image-wrap"><img src={item.image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`} alt="" loading="lazy" />{activeSection === "topSellers" && <span className="discovery-badge discovery-rank-badge">{index + 1}</span>}</span>
                <span className="discovery-card-copy">
                  <strong>{item.name}</strong>
                  <span className="discovery-card-meta">{item.releaseDate || item.subtitle || "Steam game"}
                    {activeSection === "upcoming" || activeSection === "newReleases"
                      ? <b>{item.price && Number(String(item.price).replace(/[^0-9,.-]/g, "").replace(/,/g, "")) > 0 ? item.price : "Price not announced"}</b>
                      : item.price ? <b>{item.price}</b> : null}
                  </span>
                </span>
              </a>)}
        </div>}
      {activeSection !== "freeGames" && !discoveryLoading && !discoveryError && !visibleItems.length && <div className="discovery-message">
        {activeSection === "preorders" && discovery.preordersError
          ? `Could not load Steam pre-orders: ${discovery.preordersError}`
          : "No titles available in this category right now."}
      </div>}
      <div className="discovery-sources"><span>Explore more on SteamDB</span><a href="https://steamdb.info/stats/mostwished/?displayOnly=Game" target="_blank" rel="noreferrer">Most wishlisted <ExternalLink size={11} /></a><a href="https://steamdb.info/stats/wishlistactivity/?upcoming_only=1" target="_blank" rel="noreferrer">Rising wishlist activity <ExternalLink size={11} /></a><a href="https://steamdb.info/upcoming/" target="_blank" rel="noreferrer">Upcoming releases <ExternalLink size={11} /></a></div>
      <div className="discovery-footnote">Discovery data from Steam Store · Select a game to open its full SteamPulse profile</div>
      </>}
    </section>
  );
}
