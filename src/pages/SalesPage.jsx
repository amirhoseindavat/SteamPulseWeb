import { useMemo, useState } from "react";
import { CalendarDays, Clock3, ExternalLink, LoaderCircle, RefreshCw, CalendarCheck2 } from "lucide-react";
import { useSalesData } from "../hooks/useSalesData";

function formatUpdated(timestamp) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

export default function SalesPage() {
  const { events, loading, error, lastUpdated, refresh } = useSalesData();
  const [activeTab, setActiveTab] = useState("upcoming");
  const upcoming = useMemo(() => events.filter((event) => event.status === "upcoming" || event.status === "live"), [events]);
  const history = useMemo(() => events.filter((event) => event.status === "history"), [events]);
  const visibleEvents = activeTab === "upcoming" ? upcoming : history;
  const nextMajorSale = upcoming.find((event) => /sale/i.test(event.title));

  return (
    <div className="sales-page">
      <section className="intro sales-intro">
        <div className="eyebrow"><CalendarDays size={14} /> STEAM EVENT TRACKER</div>
        <h1>Steam <span>Sales</span></h1>
        <p>Keep track of Steam's seasonal sales, themed events, festivals, and past sale dates.</p>
      </section>

      {nextMajorSale && (
        <section className="sales-feature detail-card">
          <div className="sales-feature-copy">
            <span className="section-kicker">NEXT MAJOR SALE</span>
            <h2>{nextMajorSale.title}</h2>
            <p><CalendarCheck2 size={15} /> {nextMajorSale.date || "Date announced by SteamDB"}</p>
          </div>
          <a className="secondary-button" href={nextMajorSale.url} target="_blank" rel="noreferrer">Event details <ExternalLink size={14} /></a>
        </section>
      )}

      <section className="detail-section sales-events-section">
        <div className="detail-header">
          <div><span className="section-kicker">STEAMDB CALENDAR</span><h2>Events & sale history</h2></div>
          <button className="secondary-button sales-refresh" onClick={() => refresh(true)} disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} Refresh
          </button>
        </div>

        <div className="sales-tabs">
          <button className={activeTab === "upcoming" ? "active" : ""} onClick={() => setActiveTab("upcoming")}>Upcoming & live <span>{upcoming.length}</span></button>
          <button className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>Past events <span>{history.length}</span></button>
        </div>

        {error && <div className="error-banner"><span>{error}</span><button onClick={() => refresh(true)}>Retry</button></div>}
        {loading && !events.length ? <div className="loading-panel"><LoaderCircle className="spin" size={18} /> Loading SteamDB events…</div> : (
          <div className="sales-events-grid">
            {visibleEvents.map((event) => (
              <a className="sales-event-card detail-card" href={event.url} target="_blank" rel="noreferrer" key={event.id}>
                {event.image ? <img src={event.image} alt="" loading="lazy" /> : <div className="sales-event-placeholder"><CalendarDays size={22} /></div>}
                <div className="sales-event-content">
                  <div className="sales-event-status">
                    <span className={event.status === "live" ? "live" : ""}>{event.status === "live" ? "LIVE NOW" : event.status === "history" ? "PAST EVENT" : "UPCOMING"}</span>
                    <ExternalLink size={13} />
                  </div>
                  <h3>{event.title}</h3>
                  <p><Clock3 size={13} /> {event.date || "See SteamDB for dates"}</p>
                </div>
              </a>
            ))}
            {!loading && !visibleEvents.length && !error && <div className="empty-card">No events found in this section.</div>}
          </div>
        )}
        <div className="sales-source-note">
          <span>Source: <a href="https://steamdb.info/sales/history/" target="_blank" rel="noreferrer">SteamDB</a></span>
          {lastUpdated && <span>Updated {formatUpdated(lastUpdated)}</span>}
          <span>Times shown by SteamDB are UTC.</span>
        </div>
      </section>
    </div>
  );
}
