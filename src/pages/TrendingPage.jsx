import { ChevronRight, ExternalLink, Info, LoaderCircle, RefreshCw, Gamepad2 } from "lucide-react";

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
  loadGame
}) {
  const sections = [
    ["topSellers", "Top Sellers", "TopSellers"],
    ["upcoming", "Coming Soon", "ComingSoon"],
    ["newReleases", "New Releases", "NewReleases"],
    ["preorders", "Preorders", "Preorders"]
  ];
  const items = activeSection === "newReleases"
    ? discovery.newReleases
    : activeSection === "upcoming"
      ? discovery.upcoming
      : activeSection === "preorders"
        ? discovery.preorders
        : discovery.topSellers;
  const visibleItems = (items || []).filter((item) =>
    activeSection !== "topSellers" ||
    Number(item.priceValue) > 0 ||
    (item.priceValue == null && !/\\bfree\\b/i.test(String(item.price || "")) && String(item.price || "").trim() !== "")
  );

  function openGame(item) {
    setQuery(item.name);
    setInputId(String(item.id));
    loadGame(item.id, region);
  }

  return (
    <section className="discovery-section">
      <div className="discovery-heading">
        <div><span className="section-kicker"><Gamepad2 size={13} /> GAME LIBRARY</span><h2>Explore Steam games</h2><p>Browse best sellers, upcoming launches, fresh releases and preorders.</p></div>
        <button className="discovery-refresh" onClick={() => {
          setDiscoveryLoading(true); setDiscoveryError("");
          fetch(`/api/discover?cc=${region}&refresh=1`)
            .then(async (response) => { const data = await readApiResponse(response); if (!response.ok) throw new Error(data.error || data.detail || "Refresh failed."); return data; })
            .then((data) => setDiscovery({ newReleases: data.newReleases || [], upcoming: data.upcoming || [], preorders: data.preorders || [], preordersError: data.preordersError || "", topSellers: data.topSellers || [] }))
            .catch((e) => setDiscoveryError(e.message || "Refresh failed."))
            .finally(() => setDiscoveryLoading(false));
        }} disabled={discoveryLoading}><RefreshCw size={14} className={discoveryLoading ? "spin" : ""} /> Refresh</button>
      </div>
      <nav className="discovery-tabs" aria-label="Game categories">
        {sections.map(([key, label, slug]) => <a
          key={key}
          className={activeSection === key ? "active" : ""}
          href={`/games/${slug}`}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onNavigateSection(key);
          }}
        >{label}</a>)}
      </nav>
      {discoveryError && <div className="discovery-message"><Info size={15} />{discoveryError}</div>}
      {discoveryLoading && !discovery.newReleases.length && !discovery.upcoming.length && !discovery.preorders.length && !discovery.topSellers.length
        ? <div className="discovery-loading"><LoaderCircle size={20} className="spin" />Finding games worth your attention…</div>
        : <div className="discovery-grid">
          {visibleItems.slice(0, activeSection === "topSellers" ? 20 : undefined).map((item) => activeSection === "preorders"
            ? <article className="discovery-card preorder-discovery-card" key={item.id}>
                <span className="discovery-image-wrap"><img src={item.image || ""} alt="" loading="lazy" /><span className="discovery-badge">{item.badge}</span></span>
                <span className="discovery-card-copy">
                  <strong>{item.name}</strong>
                  {item.releaseDate && <span className="discovery-card-meta">{item.releaseDate}</span>}
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
                <span className="discovery-image-wrap"><img src={item.image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`} alt="" loading="lazy" /><span className="discovery-badge">{item.badge}</span></span>
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
      {!discoveryLoading && !discoveryError && !visibleItems.length && <div className="discovery-message">
        {activeSection === "preorders" && discovery.preordersError
          ? `Could not load Steam pre-orders: ${discovery.preordersError}`
          : "No titles available in this category right now."}
      </div>}
      <div className="discovery-sources"><span>Explore more on SteamDB</span><a href="https://steamdb.info/stats/mostwished/?displayOnly=Game" target="_blank" rel="noreferrer">Most wishlisted <ExternalLink size={11} /></a><a href="https://steamdb.info/stats/wishlistactivity/?upcoming_only=1" target="_blank" rel="noreferrer">Rising wishlist activity <ExternalLink size={11} /></a><a href="https://steamdb.info/upcoming/" target="_blank" rel="noreferrer">Upcoming releases <ExternalLink size={11} /></a></div>
      <div className="discovery-footnote">Discovery data from Steam Store · Select a game to open its full SteamPulse profile</div>
    </section>
  );
}
