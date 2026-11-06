import { ChevronRight, ExternalLink, Info, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";

export default function TrendingPage({
  discovery,
  discoveryLoading,
  discoveryError,
  discoveryTab,
  setDiscoveryTab,
  setDiscoveryLoading,
  setDiscoveryError,
  setDiscovery,
  readApiResponse,
  region,
  setQuery,
  setInputId,
  loadGame
}) {
  return (
        <section className="discovery-section">
          <div className="discovery-heading">
            <div><span className="section-kicker"><Sparkles size={13} /> STEAM RADAR</span><h2>What’s hot right now</h2><p>Fresh releases, upcoming launches, and games players are buying.</p></div>
            <button className="discovery-refresh" onClick={() => {
              setDiscoveryLoading(true); setDiscoveryError("");
              fetch(`/api/discover?cc=${region}&refresh=1`)
                .then(async (response) => { const data = await readApiResponse(response); if (!response.ok) throw new Error(data.error || data.detail || "Refresh failed."); return data; })
                .then((data) => setDiscovery({ newReleases: data.newReleases || [], upcoming: data.upcoming || [], preorders: data.preorders || [], topSellers: data.topSellers || [] }))
                .catch((e) => setDiscoveryError(e.message || "Refresh failed."))
                .finally(() => setDiscoveryLoading(false));
            }} disabled={discoveryLoading}><RefreshCw size={14} className={discoveryLoading ? "spin" : ""} /> Refresh</button>
          </div>
          <div className="discovery-tabs">
            {[["trending","Trending"],["new","New releases"],["upcoming","Coming soon"],["preorders","Pre-orders"]].map(([key,label]) => <button key={key} className={discoveryTab === key ? "active" : ""} onClick={() => setDiscoveryTab(key)}>{label}</button>)}
          </div>
          {discoveryError && <div className="discovery-message"><Info size={15} />{discoveryError}</div>}
          {discoveryLoading && !discovery.newReleases.length && !discovery.upcoming.length && !discovery.preorders.length && !discovery.topSellers.length
            ? <div className="discovery-loading"><LoaderCircle size={20} className="spin" />Finding games worth your attention…</div>
            : <div className="discovery-grid">
              {(discoveryTab === "new" ? discovery.newReleases : discoveryTab === "upcoming" ? discovery.upcoming : discoveryTab === "preorders" ? discovery.preorders : discovery.topSellers).map((item) => discoveryTab === "preorders" ? <article className="discovery-card preorder-discovery-card" key={item.id}>
                <span className="discovery-image-wrap"><img src={item.image || ""} alt="" loading="lazy" /><span className="discovery-badge">{item.badge}</span></span>
                <span className="discovery-card-copy"><strong>{item.name}</strong>{item.releaseDate && <span className="discovery-card-meta">{item.releaseDate}</span>}<a className="preorder-open-button" href={"#/game/" + item.id} onClick={() => { setQuery(item.name); setInputId(String(item.id)); loadGame(item.id, region); }}>View in SteamPulse <ChevronRight size={13} /></a></span>
              </article> : <a className="discovery-card" key={item.id} href={"#/game/" + item.id} onClick={() => { setQuery(item.name); setInputId(String(item.id)); loadGame(item.id, region); }}>
                <span className="discovery-image-wrap"><img src={item.image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`} alt="" loading="lazy" /><span className="discovery-badge">{item.badge}</span></span>
                <span className="discovery-card-copy"><strong>{item.name}</strong><span className="discovery-card-meta">{item.releaseDate || item.subtitle || "Steam game"}{discoveryTab === "upcoming" || discoveryTab === "new" ? <b>{item.price && Number(String(item.price).replace(/[^0-9,.-]/g, "").replace(/,/g, "")) > 0 ? item.price : "Price not announced"}</b> : item.price ? <b>{item.price}</b> : null}</span></span>
              </a>)}
            </div>}
          {!discoveryLoading && !discoveryError && !(discoveryTab === "new" ? discovery.newReleases : discoveryTab === "upcoming" ? discovery.upcoming : discoveryTab === "preorders" ? discovery.preorders : discovery.topSellers).length && <div className="discovery-message">{discoveryTab === "preorders" && discovery.preordersError ? `Could not load Steam pre-orders: ${discovery.preordersError}` : "No titles available in this category right now."}</div>}
          <div className="discovery-sources"><span>Want deeper trend data?</span><a href="https://steamdb.info/stats/mostwished/?displayOnly=Game" target="_blank" rel="noreferrer">Most wishlisted <ExternalLink size={11} /></a><a href="https://steamdb.info/stats/wishlistactivity/?upcoming_only=1" target="_blank" rel="noreferrer">Rising wishlist activity <ExternalLink size={11} /></a><a href="https://steamdb.info/upcoming/" target="_blank" rel="noreferrer">Upcoming releases <ExternalLink size={11} /></a></div>
          <div className="discovery-footnote">Discovery data from Steam Store · Select a game to open its full SteamPulse profile</div>
        </section>

  );
}
