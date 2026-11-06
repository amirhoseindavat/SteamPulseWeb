import { useEffect, useState } from "react";

function ReleaseCountdown({ releaseDate }) {
  const target = new Date(releaseDate).getTime();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!Number.isFinite(target) || target <= Date.now()) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const remaining = target - now;
  if (!Number.isFinite(target) || remaining <= 0) return null;

  const units = [
    { label: "DAYS", value: Math.floor(remaining / 86400000) },
    { label: "HOURS", value: Math.floor((remaining % 86400000) / 3600000) },
    { label: "MINUTES", value: Math.floor((remaining % 3600000) / 60000) },
    { label: "SECONDS", value: Math.floor((remaining % 60000) / 1000) }
  ];

  return <section className="release-countdown detail-card" aria-label="Countdown to release">
    <div className="release-countdown-heading">
      <span className="release-countdown-live"><i /> COUNTDOWN TO RELEASE</span>
      <span className="release-countdown-date">{releaseDate}</span>
    </div>
    <div className="release-countdown-units">
      {units.map((unit) => <div className="release-countdown-unit" key={unit.label}>
        <strong key={unit.value} className="release-countdown-number">{String(unit.value).padStart(2, "0")}</strong>
        <span>{unit.label}</span>
      </div>)}
    </div>
    <div className="release-countdown-track"><span /></div>
  </section>;
}
export default ReleaseCountdown;
