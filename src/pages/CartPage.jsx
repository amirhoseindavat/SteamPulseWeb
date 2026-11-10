import { ShoppingCart, ExternalLink } from "lucide-react";
import { formatNumber } from "../utils/formatters";
import { REGIONS } from "../config/regions";

export default function CartPage({ steamCartApps, steamAccountConnected, steamCartDetailsError, steamCartDetailsLoading, uniqueCartDetails, cartTotalFormatted, cartOriginalTotalFormatted, cartSavingsMinor, cartSavingsFormatted, cartKeyCount, region, regionalKeyPriceForCalculation, cartCurrency }) {
  const selectedRegion = REGIONS.find((item) => item.code === region) || REGIONS[0];
  const countryFlag = selectedRegion.code
    .toUpperCase()
    .replace(/[A-Z]/g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
  return (
    <section className="steam-cart-page">
          <div className="steam-cart-heading"><div><span className="section-kicker"><ShoppingCart size={13} /> STEAM ACCOUNT</span><h1>Shopping Cart</h1><p>Your current Steam Store cart, synced from the account connected in your browser.</p></div><a className="primary-button" href="https://store.steampowered.com/cart/" target="_blank" rel="noreferrer">Open Steam Cart <ExternalLink size={14} /></a></div>
          {!steamAccountConnected ? <div className="steam-cart-empty detail-card"><ShoppingCart size={28} /><h2>Connect your Steam account</h2><p>Open Steam Store in another tab and sign in. SteamPulse Connect will sync your cart automatically.</p><a className="secondary-button" href="https://store.steampowered.com/cart/" target="_blank" rel="noreferrer">Open Steam Store <ExternalLink size={14} /></a></div> : <>
            {steamCartApps.length === 0 ? <div className="steam-cart-empty detail-card"><ShoppingCart size={28} /><h2>Your Steam cart is empty</h2><p>Add a game to your Steam cart and refresh your account snapshot to see it here.</p><a className="secondary-button" href="https://store.steampowered.com/" target="_blank" rel="noreferrer">Browse Steam Store <ExternalLink size={14} /></a></div> : <>
              {steamCartDetailsError && <p className="steam-cart-footnote">{steamCartDetailsError}</p>}
              {steamCartDetailsLoading && <p className="steam-cart-footnote">Loading item names, artwork and regional prices from Steam…</p>}
              <div className="steam-cart-items">
                {uniqueCartDetails.map((item) => <a className="steam-cart-item detail-card" key={item.type+"-"+item.id} href={item.url} target="_blank" rel="noreferrer">
                  {<img className="steam-cart-item-image" src={item.image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/header.jpg`; }} /> }
                  <span className="steam-cart-item-info"><small>STEAM GAME · {item.id}</small><strong>{item.name}</strong><span className="steam-cart-price-row">{item.discountPercent > 0 && item.formattedInitialPrice && <><del>{item.formattedInitialPrice}</del><em>{item.discountPercent}% OFF</em></>}<b>{item.formattedPrice || "Price unavailable"}</b></span></span><ExternalLink size={15} />
                </a>)}
              </div>
              <div className="steam-cart-cost-summary detail-card">
                <div><small>ESTIMATED CART TOTAL · {region}</small><strong>{steamCartDetailsLoading ? "Loading…" : cartTotalFormatted}</strong><span className="steam-cart-original-total">Original total: {steamCartDetailsLoading ? "…" : cartOriginalTotalFormatted}</span>{cartSavingsMinor > 0 && <span className="steam-cart-savings">You save {cartSavingsFormatted}</span>}</div>
                <div><small>ESTIMATED KEYS REQUIRED</small><strong>{steamCartDetailsLoading ? "…" : cartKeyCount == null ? "—" : `${formatNumber(cartKeyCount)} Keys`}</strong><span>{regionalKeyPriceForCalculation > 0 ? `Based on ${new Intl.NumberFormat("en-US", { style: "currency", currency: cartCurrency }).format(regionalKeyPriceForCalculation)} net per key` : "Regional key price is not available yet."}</span></div>
              </div>
            </>}
            <p className="steam-cart-footnote">Game details and prices are fetched from Steam Store for your selected region ({countryFlag} {selectedRegion.label}).</p>
          </>}
        </section>
  );
}
