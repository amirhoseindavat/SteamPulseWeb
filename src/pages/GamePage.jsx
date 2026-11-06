import { Search, Gamepad2, CalendarDays, ExternalLink, Monitor, Save, Library, Star, Users, Tag, ChevronRight, LoaderCircle, X, RefreshCw, Globe2, Sparkles, Image as ImageIcon, Info, CheckCircle2, CircleHelp, CircleX } from "lucide-react";
import RegionSelect from "../components/RegionSelect";
import SteamDeckMark from "../components/SteamDeckMark";
import DeckCompatibilityIcon from "../components/DeckCompatibilityIcon";
import ReleaseCountdown from "../components/ReleaseCountdown";
import Strip from "../components/Strip";
import GamePurchasePanel from "../components/GamePurchasePanel";
import GameDlcSection from "../components/GameDlcSection";
import GameNewsSection from "../components/GameNewsSection";
import RequirementsSection from "../components/RequirementsSection";
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

          <GamePurchasePanel
            hasStorePrice={hasStorePrice}
            game={game}
            hasEditions={hasEditions}
            hasBundles={hasBundles}
            gameEditions={gameEditions}
            gameBundles={gameBundles}
            missingPackages={missingPackages}
            steamAccountConnected={steamAccountConnected}
            steamOwnedPackages={steamOwnedPackages}
            purchaseTab={purchaseTab}
            setPurchaseTab={setPurchaseTab}
            selectedEditionName={selectedEditionName}
            setSelectedEditionName={setSelectedEditionName}
            setRegionalPriceInput={setRegionalPriceInput}
            calculatorRef={calculatorRef}
            region={region}
            setRegion={setRegion}
            selectedRegion={selectedRegion}
            regionalPriceInput={regionalPriceInput}
            numericRegionalPrice={numericRegionalPrice}
            regionalKeyPriceForCalculation={regionalKeyPriceForCalculation}
            keyCount={keyCount}
            totalToman={totalToman}
            liveKeyPriceToman={liveKeyPriceToman}
            shopDataError={shopDataError}
            regionalKeyPrice={regionalKeyPrice}
          />

          {game.type !== "dlc" && <section className={`deck-compatibility deck-status-${game.steam_deck?.status || "unknown"}`}>
            <div className="deck-main">
              <div className="deck-icon"><SteamDeckMark size={27} /></div>
              <div className="deck-title"><span className="section-kicker">STEAM DECK COMPATIBILITY</span><h2>{game.steam_deck?.label || "Compatibility unknown"}</h2><p>{game.steam_deck?.summary || "Steam has not published a compatibility rating for this game."}</p></div>
              <div className="deck-badge"><DeckCompatibilityIcon status={game.steam_deck?.status} size={21} /><span>{game.steam_deck?.label || "Unknown"}</span></div>
            </div>
            {(game.steam_deck?.criteria || []).length > 0 && <div className="deck-criteria">{game.steam_deck.criteria.map((item, i) => <div className={`deck-criterion deck-criterion-${item.result}`} key={`${item.name}-${i}`}><span className="criterion-icon">{item.result === "pass" ? <CheckCircle2 size={15} /> : item.result === "fail" ? <CircleX size={15} /> : <CircleHelp size={15} />}</span><span>{item.name}</span><small>{item.result === "pass" ? "PASS" : item.result === "fail" ? "ISSUE" : "INFO"}</small></div>)}</div>}
            <a className="deck-report-link" href={`https://store.steampowered.com/app/${game.appid}/`} target="_blank" rel="noreferrer">View Steam Deck details on Steam <ExternalLink size={13} /></a>
          </section>}

          <GameDlcSection
            visibleDlc={visibleDlc}
            game={game}
            steamAccountConnected={steamAccountConnected}
            steamOwnedApps={steamOwnedApps}
            steamOwnedPackages={steamOwnedPackages}
            dlcSectionCount={dlcSectionCount}
            loadMoreDlc={loadMoreDlc}
            loadingMoreDlc={loadingMoreDlc}
          />

          <section className="detail-section">
            <div className="detail-card game-intel-card"><div className="detail-header"><div><span className="section-kicker">GAME INTEL</span><h2>Inside the game</h2></div><div className="tabs">{tabNames.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div></div>
            {activeTab === "overview" && <div className="overview-grid">
              <article className="detail-card about-card"><div className="card-title"><Info size={17} /><h3>About this game</h3></div><div className="about-copy" dangerouslySetInnerHTML={{__html: game.about_the_game || game.short_description || "No description available."}} /><div className="tag-group">{(game.genres || []).map((genre) => <span className="tag" key={genre}>{genre}</span>)}</div>
                <div className="people-grid"><div><small>DEVELOPED BY</small><strong>{game.developers?.join(", ") || "Not listed"}</strong></div><div><small>PUBLISHED BY</small><strong>{game.publishers?.join(", ") || "Not listed"}</strong></div></div>
              </article>
              
            </div>}
            {activeTab === "screenshots" && <div className="screenshots-grid">{(game.screenshots || []).length ? game.screenshots.map((src, i) => <a href={src} target="_blank" rel="noreferrer" key={src} className="screenshot-card"><img src={src} loading="lazy" alt={`${game.name} screenshot ${i + 1}`} /><span><ImageIcon size={14} /> SCREENSHOT {String(i + 1).padStart(2,"0")} <ExternalLink size={13} /></span></a>) : <div className="empty-card">No screenshots are available for this title.</div>}</div>}
            {activeTab === "videos" && <div className="videos-grid">{(game.movies || []).length ? game.movies.map((movie, i) => <article className="video-card" key={`${movie.webm || movie.mp4}-${i}`}><a href={movie.mp4 || movie.webm} target="_blank" rel="noreferrer" className="video-thumb"><img src={movie.thumbnail} loading="lazy" alt="" /><span><Gamepad2 size={18} /></span></a><div className="video-copy"><strong>{movie.name || `${game.name} video ${i + 1}`}</strong><a href={movie.mp4 || movie.webm} target="_blank" rel="noreferrer">Watch video <ExternalLink size={13} /></a></div></article>) : <div className="empty-card">No videos are available for this title.</div>}</div>}
             <GameNewsSection activeTab={activeTab} game={game} hero={hero} />
             <RequirementsSection activeTab={activeTab} game={game} />
            </div>
          </section>
        </>}
    </>
  );
}
