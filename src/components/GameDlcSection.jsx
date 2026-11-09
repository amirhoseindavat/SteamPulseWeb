import { ChevronRight, ExternalLink, Gamepad2, Library, LoaderCircle } from "lucide-react";

export default function GameDlcSection({
  visibleDlc,
  game,
  steamAccountConnected,
  steamOwnedApps,
  steamOwnedPackages,
  dlcSectionCount,
  loadMoreDlc,
  loadingMoreDlc,
  loadGame,
  region,
  showOwnership = true
}) {
  if (!visibleDlc.length) return null;

  return (
    <section className="extra-content-section detail-card dlc-section-card"><div className="detail-header"><div><span className="section-kicker">EXPAND YOUR GAME</span><h2>Downloadable content</h2><p className="purchase-hint">Open a DLC here or view its Steam store page.</p></div><span className="section-count">{dlcSectionCount}</span></div><div className="dlc-grid">{visibleDlc.map((item) => <article className={`dlc-card ${showOwnership && showOwnership && steamAccountConnected && (steamOwnedApps.has(Number(item.appid)) || steamOwnedPackages.has(Number(item.appid))) ? "dlc-card-owned" : ""}`} key={item.appid}><img src={item.image || game.header_image} alt="" loading="lazy" /><div className="dlc-copy"><div className="dlc-title-row"><strong>{item.name}</strong>{steamAccountConnected && (steamOwnedApps.has(Number(item.appid)) || steamOwnedPackages.has(Number(item.appid))) && <span className="dlc-ownership is-owned">✓ OWNED</span>}</div><small>APP ID · {item.appid}</small><span>{item.price || "Price unavailable"}</span><div className="dlc-actions"><a className="dlc-open-button" href={"#/game/" + item.appid} onClick={() => loadGame(item.appid, region)}><Gamepad2 size={13} /> Show details</a><a className="dlc-store-button" href={item.url} target="_blank" rel="noreferrer">Steam <ExternalLink size={12} /></a></div></div></article>)}</div>{(game.dlc_has_more ?? (game.dlc.length < game.dlc_total)) && <div className="dlc-load-more"><p className="dlc-note">Showing {game.dlc.length} of {game.dlc_total} DLC items.</p><button type="button" className="secondary-button" onClick={loadMoreDlc} disabled={loadingMoreDlc}>{loadingMoreDlc ? <><LoaderCircle size={15} className="spin" /> Loading DLCs…</> : <><ChevronRight size={15} /> Load more DLCs</>}</button></div>}</section>
  );
}
