import { useEffect, useMemo, useState } from "react";
import { majorSteamSales } from "../data/steamSales";

export function useSalesData() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const event = useMemo(() => {
    const current = majorSteamSales
      .map((sale) => ({
        ...sale,
        startAt: new Date(sale.start).getTime(),
        endAt: new Date(sale.end).getTime()
      }))
      .filter((sale) => Number.isFinite(sale.startAt) && Number.isFinite(sale.endAt) && sale.endAt > now)
      .sort((a, b) => a.startAt - b.startAt);

    const liveSale = current.find((sale) => sale.startAt <= now && now < sale.endAt);
    const nextSale = current.find((sale) => sale.startAt > now);
    const selected = liveSale || nextSale;

    return selected ? { ...selected, isLive: Boolean(liveSale) } : null;
  }, [now]);

  return { event, now };
}
