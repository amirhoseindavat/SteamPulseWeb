import { Search, Gamepad2, CalendarDays, ExternalLink, Monitor, Save, Library, Star, Users, Tag, ChevronRight, LoaderCircle, X, RefreshCw, Globe2, Sparkles, Image as ImageIcon, Info, CheckCircle2, CircleHelp, CircleX } from "lucide-react";
import RegionSelect from "../components/RegionSelect";
import SteamDeckMark from "../components/SteamDeckMark";
import DeckCompatibilityIcon from "../components/DeckCompatibilityIcon";
import ReleaseCountdown from "../components/ReleaseCountdown";
import Strip from "../components/Strip";
import { money, formatNumber } from "../utils/formatters";
import { hasCompleteReleaseDate } from "../utils/releaseDate";

export default function GamePage({
  currentPage,
  region,
  setRegion,
  steamAccountSnapshot,
  ownership,
  appid,
  game,
  loading,
  loadingMoreDlc,
  error,
  setError,
  activeTab,
  setActiveTab,
  regionalPriceInput,
  setRegionalPriceInput,
  selectedEditionName,
  setSelectedEditionName,
  purchaseTab,
  setPurchaseTab,
  shopDataError,
  regionalKeyPrice,
  loadGame,
  loadMoreDlc,
  calculatorRef,
  steamAccountConnected,
  steamOwnedApps,
  steamOwnedPackages,
  gameEditions,
  gameBundles,
  hasEditions,
  hasBundles,
  missingPackages,
  visibleDlc,
  dlcSectionCount,
  gameIsWishlisted,
  gameIsOwned,
  hero,
  price,
  hasStorePrice,
  selectedRegion,
  numericRegionalPrice,
  regionalKeyPriceForCalculation,
  keyCount,
  liveKeyPriceToman,
  totalToman,
  systemNames,
  tabNames
}) {
  return (
    <>
        {currentPage === "game" && error && <div className="error-banner"><Info size={18} /><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}
        {loading && <div className="loading-panel"><LoaderCircle className="spin" size={26} /><span>Syncing game data from Steam…</span></div>}

        {currentPage === "game" && !game && !loading && <section className="welcome-panel"><Gamepad2 size={36} /><h2>Ready when you are</h2><p>Search for a game above to pull its Steam Store details.</p></section>}

        {currentPage === "game" && game && <>
          <section className="game-hero">
            <div className="hero-art" style={{backgroundImage: game.type === "dlc" && game.background_raw ? `linear-gradient(90deg, rgba(8,13,27,.82) 0%, rgba(8,13,27,.68) 48%, rgba(8,13,27,.5) 100%), url("${game.background_raw}")` : game?.library_hero ? `linear-gradient(90deg, rgba(8,13,27,.82) 0%, rgba(8,13,27,.68) 48%, rgba(8,13,27,.5) 100%), url("${game.library_hero}")` : hero ? `linear-gradient(90deg, rgba(8,13,27,.92) 0%, rgba(8,13,27,.82) 48%, rgba(8,13,27,.58) 100%), url("${hero}")` : "linear-gradient(120deg,#172541,#111827)"}} />
            <div className="hero-header-image"><img src={game.header_image || hero || ""} alt={`${game.name} header`} onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /></div>
            <div className="hero-content">
              <div className="hero-topline game-hero-topline"></div>
              {game.pre_purchase && <div className="title-extra-meta pre-purchase-package-names"><span className="tag">PRE-PURCHASE</span></div>}
              <h2>{game.name}</h2>{game.developers?.length > 0 && <div className="hero-developer">Developed by {game.developers.slice(0, 2).join(", ")}</div>}<p className="hero-description">{game.short_description || game.about_the_game?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 320) || "No short description is available for this title."}</p>{game.type !== "dlc" && <div className="title-ownership-status"><span className="section-kicker"><Library size={13} /> STEAM ACCOUNT</span>{steamAccountConnected ? <div className="steam-account-statuses"><strong className={gameIsOwned ? "owned" : "not-owned"}>{gameIsOwned ? (steamOwnedApps.has(Number(game.appid)) ? "✓ Owned" : "✓ Owned via package") : "Not owned"}</strong>{!gameIsOwned && <strong className={gameIsWishlisted ? "wishlisted" : "not-wishlisted"}>{gameIsWishlisted ? "♥ Wishlisted" : "Not wishlisted"}</strong>}</div> : ownership ? (() => { const title = ownership.items.find((item) => Number(item.appid) === Number(game.appid)); return <strong className={title?.owned ? "owned" : "not-owned"}>{title?.owned ? "✓ Owned" : "Not owned"}</strong>; })() : <strong>{steamAccountSnapshot?.loginStatus === "disconnected" ? "Open Steam and sign in" : "Install SteamPulse Connect and open Steam"}</strong>}</div>}<div className="title-extra-meta">{(game.genres || []).slice(0, 4).map((genre) => <span className="tag" key={genre}>{genre}</span>)}</div>
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
                </div>
            </div>
                <div className="hero-utility-actions">
                  <button className="secondary-button" onClick={() => loadGame(appid)} title="Refresh game data" aria-label="Refresh game data"><RefreshCw size={15} /></button>
                </div>
            <div className="hero-corner">APP/{game.appid}</div>
          </section>
          {(game.type === "dlc" || game.coming_soon) && hasCompleteReleaseDate(game.release_date) && new Date(game.release_date).getTime() > Date.now() && <ReleaseCountdown releaseDate={game.release_date} />}
          {game.franchise?.url && <a className="steam-franchise-notice" href={game.franchise.url} target="_blank" rel="noreferrer" style={game.franchise.image ? { "--franchise-image": 'url("' + game.franchise.image + '")' } : undefined}>
            <span className="steam-franchise-background" />
            <span className="steam-franchise-copy"><small>EXPLORE THE FRANCHISE</small><strong>{game.franchise.name}</strong><span>View the entire collection on Steam <ExternalLink size={13} /></span></span>
            <span className="steam-franchise-arrow"><ChevronRight size={20} /></span>
          </a>}
          {game.type !== "dlc" && <section className="stats-strip">
            <Strip label="CURRENT PRICE" value={price} icon={Tag} />
            <Strip label="PLAYERS ONLINE" value={formatNumber(game.player_count)} icon={Users} />
            <Strip label="METACRITIC" value={game.metacritic?.score ?? "—"} icon={Star} />
          </section>}

          {game.type === "dlc" && <section className="dlc-parent-notice detail-card"><div className="dlc-parent-icon"><Library size={22} /></div><div className="dlc-parent-copy"><span className="section-kicker">DLC · BASE GAME REQUIRED</span><h3>This content requires the base game</h3><p>This is downloadable content, not a standalone game. You need to own the base game on Steam to access it.</p>{game.parent_game?.appid ? <><div className="dlc-parent-game"><img src={game.parent_game.header_image || ("https://cdn.akamai.steamstatic.com/steam/apps/" + game.parent_game.appid + "/header.jpg")} alt="" loading="lazy" /><div className="dlc-parent-game-info"><strong>{game.parent_game.name}</strong><small>Required base game</small></div></div><div className="dlc-parent-actions"><a className="dlc-parent-action dlc-parent-steam" href={"https://store.steampowered.com/app/" + game.parent_game.appid + "/"} target="_blank" rel="noreferrer">View base game on Steam <ExternalLink size={14} /></a><a className="dlc-parent-action dlc-parent-steampulse" href={"#/game/" + game.parent_game.appid}>View base game on SteamPulse <ChevronRight size={15} /></a></div></> : <p className="dlc-parent-unknown">Check the DLC store page for its required base game.</p>}</div></section>}

          {hasStorePrice && <div className="purchase-layout">
            <div className="purchase-options-column">
            {game.type !== "edition" && ((game.editions || []).length > 0 || (game.bundles || []).length > 0) && <section className="extra-content-section purchase-options-panel">
              <div className="detail-header"><div><span className="section-kicker">PURCHASE OPTIONS</span><h2>Choose your version</h2><p className="purchase-hint">Select an edition or bundle to calculate its required keys and estimated cost.</p></div></div>
              {hasEditions && hasBundles && <div className="purchase-tabs" role="tablist" aria-label="Purchase options">
                <button type="button" role="tab" aria-selected={purchaseTab === "editions"} className={purchaseTab === "editions" ? "purchase-tab-active" : ""} onClick={() => setPurchaseTab("editions")}>Packages <span>{gameEditions.length + missingPackages.length}</span></button>
                <button type="button" role="tab" aria-selected={purchaseTab === "bundles"} className={purchaseTab === "bundles" ? "purchase-tab-active" : ""} onClick={() => setPurchaseTab("bundles")}>Bundles <span>{gameBundles.length}</span></button>
              </div>}
              {hasEditions && (!hasBundles || purchaseTab === "editions") && <div className="editions-grid purchase-editions-grid">
                {gameEditions.map((edition, i) => <article className={`edition-card ${steamAccountConnected && edition.packageId != null && steamOwnedPackages.has(Number(edition.packageId)) ? "edition-card-owned" : ""} ${selectedEditionName === (edition.name || "").replace(/\s*-\s*\$\s*$/, "") ? "edition-card-selected" : ""}`} key={`${edition.packageId || edition.name}-${i}`}>
                  <button className="edition-select" onClick={() => { if (edition.priceValue != null) { setRegionalPriceInput(String(edition.priceValue)); setSelectedEditionName((edition.name || "").replace(/\s*-\s*\$\s*$/, "")); calculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }} disabled={edition.priceValue == null} title={edition.priceValue == null ? "Price unavailable for calculation" : "Calculate required keys for this option"}>
                    <div className="edition-top"><span className="edition-tag">{edition.kind || "STEAM EDITION"}</span><span className="edition-top-status">{steamAccountConnected ? (edition.packageId == null ? "Ownership unavailable" : steamOwnedPackages.has(Number(edition.packageId)) ? "✓ Owned" : "") : "Ownership unavailable"}</span>{edition.savings && Number(edition.savings) > 0 && <span className="edition-discount">-{edition.savings}%</span>}</div>
                    <span className="edition-package-id">PACKAGE · {edition.packageId ?? "ID unavailable"}</span>
                    <h3>{(edition.name || "").replace(/\s*-\s*\$\s*$/, "")}</h3><p>{edition.description || "Steam purchase option"}</p>
                    <div className="edition-bottom"><div className="edition-prices">{edition.originalPrice && edition.savings && Number(edition.savings) > 0 && <del>{edition.originalPrice}</del>}<strong>{edition.price || "Price unavailable"}</strong></div>{edition.savings && Number(edition.savings) > 0 && <span className="edition-save-label">Save {edition.savings}%</span>}</div>
                    <span className="edition-calculate">{edition.priceValue != null ? "Calculate keys" : "Price unavailable"} <ChevronRight size={13} /></span>
                  </button>{edition.url && <a className="edition-external-link" href={edition.url} target="_blank" rel="noreferrer">View on Steam <ExternalLink size={13} /></a>}
                </article>)}
                {missingPackages.map((edition) => <article className={`edition-card ${steamOwnedPackages.has(edition.packageId) ? "edition-card-owned" : ""}`} key={edition.packageId}>
                  <div className="edition-top"><span className="edition-tag">STEAM PACKAGE</span><span className="edition-top-status">{steamAccountConnected ? (steamOwnedPackages.has(edition.packageId) ? "✓ Owned" : "") : "Ownership unavailable"}</span></div>
                  <span className="edition-package-id">PACKAGE · {edition.packageId}</span><h3>{edition.name}</h3><p>{edition.description}</p>
                  <div className="edition-bottom"><div className="edition-prices"><strong>{steamOwnedPackages.has(edition.packageId) ? "Owned" : "Package details unavailable"}</strong></div></div>
                  <a className="edition-external-link" href={edition.url} target="_blank" rel="noreferrer">View on Steam <ExternalLink size={13} /></a>
                </article>)}
              </div>}
              {hasBundles && (!hasEditions || purchaseTab === "bundles") && <div className="bundle-list">
                {(game.bundles || []).length ? game.bundles.map((bundle) => <article className={`bundle-row ${selectedEditionName === (bundle.name || "").replace(/\s*-\s*\$\s*$/, "") ? "edition-card-selected" : ""}`} key={bundle.id}>
                  <button className="bundle-select" onClick={() => { if (bundle.priceValue != null) { setRegionalPriceInput(String(bundle.priceValue)); setSelectedEditionName((bundle.name || "").replace(/\s*-\s*\$\s*$/, "")); calculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }} disabled={bundle.priceValue == null} title={bundle.priceValue == null ? "Price unavailable for calculation" : "Calculate required keys for this bundle"}>
                    <span className={`bundle-thumb ${bundle.image ? "" : "bundle-thumb-empty"}`}>{bundle.image ? <img src={bundle.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement.classList.add("bundle-thumb-empty"); }} /> : <Tag size={18} />}</span>
                    <span className="bundle-copy"><strong>{(bundle.name || "").replace(/\s*-\s*\$\s*$/, "")}</strong><small>{bundle.appCount ? `Includes ${bundle.appCount} games or items, including this title` : "Steam bundle featuring this title"}</small><span className="bundle-price">{bundle.originalPrice && bundle.originalPrice !== bundle.price && <del>{bundle.originalPrice}</del>}<b>{bundle.price || "Price unavailable"}</b>{bundle.savings && <em>{bundle.savings}% OFF</em>}</span></span>
                    <span className="bundle-calculate">{bundle.priceValue != null ? "Calculate keys" : "Unavailable"} <ChevronRight size={14} /></span>
                  </button><a className="bundle-store-link" href={bundle.url} target="_blank" rel="noreferrer" aria-label={`View ${bundle.name} on Steam`}><ExternalLink size={14} /></a>
                </article>) : <div className="purchase-empty-state">No Steam bundles found for this game.</div>}
              </div>}
            </section>}
            </div>
            <section className="key-calculator detail-card" ref={calculatorRef}>
              <div className="calculator-heading"><div><span className="section-kicker">KEY COST ESTIMATOR</span><h2>Calculate your key cost</h2><p>Choose the Steam region and price to estimate how many keys you need and the total cost.</p></div><div className="calculator-icon"><Tag size={21} /></div></div><label className="calculator-region"><span><Globe2 size={15} /> Steam price region</span><RegionSelect value={region} onChange={(nextRegion) => { setRegion(nextRegion); localStorage.setItem("steampulse-region", nextRegion); }} /></label>
              <div className="calculator-content">
                <div className="calculator-result usd-price-display"><small>STEAM PRICE</small><strong>{regionalPriceInput.trim() !== "" && Number.isFinite(numericRegionalPrice) ? formatNumber(numericRegionalPrice) : "—"} <span>{selectedRegion.currency}</span></strong><p>Steam store price · {selectedRegion.label}</p></div>
                <div className="calculator-result"><small>KEYS REQUIRED</small><strong>{keyCount ? formatNumber(keyCount) : "—"} <span>Keys</span></strong><p>{keyCount && regionalKeyPriceForCalculation > 0 ? `${keyCount} × ${formatNumber(regionalKeyPriceForCalculation)} ${selectedRegion.currency} net/key` : regionalKeyPrice?.error || "Loading live Steam key price for this region…"}</p></div>
                <div className="calculator-result cost-result"><small>ESTIMATED COST</small><strong>{keyCount ? formatNumber(totalToman) : "—"} <span>toman</span></strong><p>{keyCount && liveKeyPriceToman > 0 ? `${keyCount} × ${formatNumber(liveKeyPriceToman)} toman` : shopDataError || regionalKeyPrice?.error || "Loading live shop key price…"}</p></div>
              </div>
            </section>
          </div>}

          {game.type !== "dlc" && <section className={`deck-compatibility deck-status-${game.steam_deck?.status || "unknown"}`}>
            <div className="deck-main">
              <div className="deck-icon"><SteamDeckMark size={27} /></div>
              <div className="deck-title"><span className="section-kicker">STEAM DECK COMPATIBILITY</span><h2>{game.steam_deck?.label || "Compatibility unknown"}</h2><p>{game.steam_deck?.summary || "Steam has not published a compatibility rating for this game."}</p></div>
              <div className="deck-badge"><DeckCompatibilityIcon status={game.steam_deck?.status} size={21} /><span>{game.steam_deck?.label || "Unknown"}</span></div>
            </div>
            {(game.steam_deck?.criteria || []).length > 0 && <div className="deck-criteria">{game.steam_deck.criteria.map((item, i) => <div className={`deck-criterion deck-criterion-${item.result}`} key={`${item.name}-${i}`}><span className="criterion-icon">{item.result === "pass" ? <CheckCircle2 size={15} /> : item.result === "fail" ? <CircleX size={15} /> : <CircleHelp size={15} />}</span><span>{item.name}</span><small>{item.result === "pass" ? "PASS" : item.result === "fail" ? "ISSUE" : "INFO"}</small></div>)}</div>}
            <a className="deck-report-link" href={`https://store.steampowered.com/app/${game.appid}/`} target="_blank" rel="noreferrer">View Steam Deck details on Steam <ExternalLink size={13} /></a>
          </section>}

          {visibleDlc.length > 0 && <section className="extra-content-section detail-card dlc-section-card"><div className="detail-header"><div><span className="section-kicker">EXPAND YOUR GAME</span><h2>Downloadable content</h2><p className="purchase-hint">Open a DLC here or view its Steam store page.</p></div><span className="section-count">{dlcSectionCount}</span></div><div className="dlc-grid">{visibleDlc.map((item) => <article className={`dlc-card ${steamAccountConnected && (steamOwnedApps.has(Number(item.appid)) || steamOwnedPackages.has(Number(item.appid))) ? "dlc-card-owned" : ""}`} key={item.appid}><img src={item.image || game.header_image} alt="" loading="lazy" /><div className="dlc-copy"><div className="dlc-title-row"><strong>{item.name}</strong>{steamAccountConnected && (steamOwnedApps.has(Number(item.appid)) || steamOwnedPackages.has(Number(item.appid))) && <span className="dlc-ownership is-owned">✓ OWNED</span>}</div><small>APP ID · {item.appid}</small><span>{item.price || "Price unavailable"}</span><div className="dlc-actions"><a className="dlc-open-button" href={"#/game/" + item.appid} onClick={() => loadGame(item.appid, region)}><Gamepad2 size={13} /> Show details</a><a className="dlc-store-button" href={item.url} target="_blank" rel="noreferrer">Steam <ExternalLink size={12} /></a></div></div></article>)}</div>{(game.dlc_has_more ?? (game.dlc.length < game.dlc_total)) && <div className="dlc-load-more"><p className="dlc-note">Showing {game.dlc.length} of {game.dlc_total} DLC items.</p><button type="button" className="secondary-button" onClick={loadMoreDlc} disabled={loadingMoreDlc}>{loadingMoreDlc ? <><LoaderCircle size={15} className="spin" /> Loading DLCs…</> : <><ChevronRight size={15} /> Load more DLCs</>}</button></div>}</section>}

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
        </>}
    </>
  );
}
