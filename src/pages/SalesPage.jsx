import { CalendarDays, CalendarCheck2, ExternalLink, Clock3, Tag } from "lucide-react";
import { useSalesData } from "../hooks/useSalesData";

function formatSaleDate(startAt, endAt) {
  const options = { month: "short", day: "numeric", year: "numeric", timeZoneName: "short" };
  const start = new Intl.DateTimeFormat("en-US", options).format(new Date(startAt));
  const end = new Intl.DateTimeFormat("en-US", options).format(new Date(endAt));
  return `${start} — ${end}`;
}

function getCountdown(target, now) {
  const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };
}

function Countdown({ target, now, label }) {
  const time = getCountdown(target, now);
  const units = [
    ["DAYS", time.days],
    ["HOURS", time.hours],
    ["MINUTES", time.minutes],
    ["SECONDS", time.seconds]
  ];

  return (
    <div className="sales-countdown">
      <div className="sales-countdown-heading">
        <span>{label}</span>
        <span><Clock3 size={13} /> {label === "STARTS IN" ? "Countdown to opening" : "Time remaining"}</span>
      </div>
      <div className="sales-countdown-units">
        {units.map(([unit, value]) => (
          <div className="sales-countdown-unit" key={unit}>
            <strong>{String(value).padStart(2, "0")}</strong>
            <span>{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SalesPage() {
  const { event, now } = useSalesData();

  return (
    <div className="sales-page">
      <section className="intro sales-intro">
        <div className="eyebrow"><CalendarDays size={14} /> STEAM SEASONAL SALES</div>
        <h1>Steam <span>Sales</span></h1>
        <p>Track the next major Steam-wide seasonal sale. Only the nearest confirmed event is shown.</p>
      </section>

      {event ? (
        <section className={`sales-next-card detail-card ${event.isLive ? "is-live" : ""}`}>
          <div className="sales-next-topline">
            <span className="section-kicker"><Tag size={13} /> FOUR MAJOR SEASONAL SALES</span>
            <span className={`sales-status-pill ${event.isLive ? "live" : ""}`}>
              <i /> {event.isLive ? "LIVE NOW" : "UPCOMING"}
            </span>
          </div>

          <div className="sales-next-main">
            <div className="sales-next-copy">
              <span className="sales-next-label">{event.isLive ? "CURRENT MAJOR SALE" : "NEXT MAJOR SALE"}</span>
              <h2>{event.name}</h2>
              <p><CalendarCheck2 size={16} /> {formatSaleDate(event.startAt, event.endAt)}</p>
            </div>
            <a className="sales-store-link secondary-button" href="https://store.steampowered.com/" target="_blank" rel="noreferrer">
              Open Steam Store <ExternalLink size={14} />
            </a>
          </div>

          <Countdown
            target={event.isLive ? event.endAt : event.startAt}
            now={now}
            label={event.isLive ? "ENDS IN" : "STARTS IN"}
          />

          <div className="sales-next-footer">
            <span><Clock3 size={13} /> Starts at 10:00 AM Pacific Time</span>
            <span>Only the next major sale is displayed</span>
          </div>
        </section>
      ) : (
        <section className="sales-next-card detail-card sales-no-event">
          <CalendarDays size={30} />
          <h2>No confirmed upcoming sale</h2>
          <p>Valve has not announced the next major seasonal sale yet. Check back when the official schedule is updated.</p>
        </section>
      )}

      <div className="sales-source-note">
        <span>Official source: <a href="https://partner.steamgames.com/doc/marketing/upcoming_events" target="_blank" rel="noreferrer">Steamworks – Upcoming Steam Events</a></span>
        <span>Dates and times are displayed in your local timezone.</span>
      </div>
    </div>
  );
}
