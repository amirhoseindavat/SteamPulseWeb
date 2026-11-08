import { useEffect, useMemo, useState } from "react";
import { majorSteamSales, themedSteamEvents } from "../data/steamSales";

function prepareEvents(events, now) {
  return events
    .map((event) => ({
      ...event,
      startAt: new Date(event.start).getTime(),
      endAt: new Date(event.end).getTime()
    }))
    .filter((event) => Number.isFinite(event.startAt) && Number.isFinite(event.endAt) && event.endAt > now)
    .sort((a, b) => a.startAt - b.startAt);
}

export function useSalesData() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const { event, themedEvents } = useMemo(() => {
    const majorEvents = prepareEvents(majorSteamSales, now);
    const fests = prepareEvents(themedSteamEvents, now);
    const liveMajor = majorEvents.find((sale) => sale.startAt <= now && now < sale.endAt);
    const nextMajor = majorEvents.find((sale) => sale.startAt > now);
    const selectedMajor = liveMajor || nextMajor;

    const orderedFests = fests.map((fest) => ({
      ...fest,
      isLive: fest.startAt <= now && now < fest.endAt
    }));

    return {
      event: selectedMajor ? { ...selectedMajor, isLive: Boolean(liveMajor) } : null,
      themedEvents: orderedFests
    };
  }, [now]);

  return { event, themedEvents, now };
}
