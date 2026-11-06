import { Tag, RefreshCw, Globe2, Info, LoaderCircle, ExternalLink } from "lucide-react";
import { formatNumber } from "../utils/formatters";

export default function MarketPage({ shopDataError, shopDataLoading, regionalMarketError, regionalMarketLoading, regionalMarketData, regionalMarketUpdatedAt, shopData, shopDataUpdatedAt, region, onRefresh }) {
  return (
    <section className="market-page">
          <div className="market-heading"><div><span className="section-kicker"><Tag size={13} /> STEAMPULSE MARKET</span><h1>Steam key market</h1><p>Live Iranian shop prices, stock and purchase links.</p></div><button className="market-refresh" onClick={onRefresh} disabled={shopDataLoading}><RefreshCw size={14} className={shopDataLoading ? "spin" : ""} /> Refresh prices</button></div>
          <section className="regional-market-section detail-card">
            <div className="regional-market-heading">
              <div><span className="section-kicker"><Globe2 size={13} /> STEAM COMMUNITY MARKET</span><h2>TF2 Key · Regional prices</h2><p>Live market sell orders and estimated proceeds from Steam's order histogram.</p></div>
              <span className={regionalMarketError ? "regional-market-live is-error" : "regional-market-live"}><span />{regionalMarketError ? "Unavailable" : regionalMarketLoading && !regionalMarketData.length ? "Loading market…" : "LIVE"}</span>
            </div>
            {regionalMarketError && <div className="market-error"><Info size={16} />{regionalMarketError}</div>}
            {regionalMarketLoading && !regionalMarketData.length ? <div className="market-loading"><LoaderCircle size={20} className="spin" /> Loading regional Steam Market orders…</div> : <>
              <div className="regional-order-summary">
                <div className="regional-order-stat"><span>Sell orders · Steam market</span><strong>{(() => { const value = Number(String(regionalMarketData.find((item) => item.code === "US")?.sellOrderCount ?? "").replace(/[，,\s]/g, "")); return Number.isFinite(value) && value > 0 ? formatNumber(value) : "—"; })()}</strong></div>
                <div className="regional-order-stat"><span>Buy orders · Steam market</span><strong>{(() => { const value = Number(String(regionalMarketData.find((item) => item.code === "US")?.buyOrderCount ?? "").replace(/[，,\s]/g, "")); return Number.isFinite(value) && value > 0 ? formatNumber(value) : "—"; })()}</strong></div>
              </div>
              <div className="regional-market-table-wrap">
                <table className="regional-market-table">
                  <thead><tr><th>Country / region</th><th>Lowest sell</th><th>Net estimate</th><th>Change</th></tr></thead>
                  <tbody>
                    {regionalMarketData.map((item) => <tr key={item.code}>
                      <td><span className="regional-name"><img className="regional-flag" src={`https://flagcdn.com/w40/${item.code === "EU" ? "eu" : item.country.toLowerCase()}.png`} alt="" loading="lazy" /><span><strong>{item.label}</strong></span></span></td>
                      <td className="regional-price">{item.lowestSellFormatted || "—"}</td>
                      <td className="regional-net">{item.netFormatted || "—"}</td>
                      <td><span className={item.change == null ? "regional-change" : item.change > 0 ? "regional-change up" : item.change < 0 ? "regional-change down" : "regional-change"}>{item.change == null ? "—" : item.change > 0 ? `▲ ${item.changeFormatted}` : item.change < 0 ? `▼ ${item.changeFormatted}` : "—"}</span></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </>}
            <p className="market-footnote"><Info size={14} /> Prices come from Steam Community Market order histograms. Net estimate subtracts an estimated 13% marketplace fee; it is indicative, not a guaranteed payout. {regionalMarketUpdatedAt ? `Last fetched: ${regionalMarketUpdatedAt.toLocaleTimeString()}.` : ""}</p>
          </section>
          <div className="market-status"><span className={shopDataError ? "market-status-dot is-error" : "market-status-dot"} />{shopDataError ? "Live data unavailable" : shopDataLoading && !shopData ? "Connecting to shop API…" : "Live shop data"}<span className="market-updated">{shopData?.LastUpdateDate ? `Source updated: ${shopData.LastUpdateDate}` : shopDataUpdatedAt ? `Fetched: ${shopDataUpdatedAt.toLocaleTimeString()}` : "Waiting for first update"}</span></div>
          {shopDataError && <div className="market-error"><Info size={16} />{shopDataError}</div>}
          {shopDataLoading && !shopData ? <div className="market-loading detail-card"><LoaderCircle size={22} className="spin" /> Loading live prices…</div> : shopData && <>
            <div className="market-product-grid">
              <article className="market-product-card detail-card"><div className="market-product-top"><img className="market-product-image" src="https://community.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEAaR4uURrwvz0N252yVaDVWrRTno9m4ccG2GNqxlQoZrC2aG9hcVGUWflbX_drrVu5UGki5sAij6tOtQ" alt="Mann Co. Supply Crate Key" loading="lazy" /><span className="market-live-tag">LIVE PRICE</span></div><span className="market-product-label">TF2 Key</span><strong className="market-price">{formatNumber(shopData.Key)} <small>toman</small></strong><div className="market-product-meta"><span>Available stock</span><strong>{formatNumber(shopData.KeyStock)} keys</strong></div><a className="market-buy-button" href={shopData.KeyUrl} target="_blank" rel="noreferrer">Buy TF2 Keys <ExternalLink size={14} /></a></article>
              <article className="market-product-card detail-card"><div className="market-product-top"><img className="market-product-image" src="https://community.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEGegouSRLhsz1Xt8TnH_WJRuNVy49itMUB32JtklgoN7OzZTQxJFPEV_lfBa1irV-9C3Zr6sU6AdH457UBdvwbXdU" alt="Tour of Duty Ticket" loading="lazy" /><span className="market-live-tag">LIVE PRICE</span></div><span className="market-product-label">TF2 Ticket</span><strong className="market-price">{formatNumber(shopData.Ticket)} <small>toman</small></strong><div className="market-product-meta"><span>Available stock</span><strong>{formatNumber(shopData.TicketStock)} tickets</strong></div><a className="market-buy-button" href={shopData.TicketUrl} target="_blank" rel="noreferrer">Buy TF2 Tickets <ExternalLink size={14} /></a></article>
            </div>
            <p className="market-footnote"><Info size={14} /> Prices are refreshed automatically every 60 seconds. Last source update: {shopData.LastUpdateDate || (shopData.LastUpdate ? new Date(Number(shopData.LastUpdate) * 1000).toLocaleString() : "not provided")}.</p>
          </>}
        </section>}

        <CalculatorPage region={region} setRegion={setRegion} conversionMode={conversionMode} setConversionMode={setConversionMode} conversionAmount={conversionAmount} setConversionAmount={setConversionAmount} selectedRegion={selectedRegion} conversionResult={conversionResult} conversionResultFormatted={conversionResultFormatted} conversionResultLabel={conversionResultLabel} regionalKeyPrice={regionalKeyPrice} regionalKeyPriceForCalculation={regionalKeyPriceForCalculation} liveKeyPriceToman={liveKeyPriceToman} shopDataError={shopDataError} />
  );
}
