import { useCallback, useEffect, useState } from "react";

const SALES_URL = "https://steamdb.info/sales/history/";
const CACHE_KEY = "steampulse-sales-cache";
const CACHE_MAX_AGE = 30 * 60 * 1000;

function cleanText(value) {
  return String(value || "").replace(/\\s+/g, " ").trim();
}

function extractEvents(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const headings = [...parsed.querySelectorAll("h3")];
  const events = [];
  let section = "upcoming";

  for (const heading of headings) {
    const headingText = cleanText(heading.textContent);
    if (!headingText) continue;

    const previousSection = [...parsed.querySelectorAll("h2")]
      .filter((item) => item.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)
      .pop();
    const sectionText = cleanText(previousSection?.textContent).toLowerCase();
    if (sectionText.startsWith("year")) section = "history";
    else if (sectionText.includes("upcoming")) section = "upcoming";

    const link = heading.querySelector("a[href]") || heading.closest("a[href]");
    if (!link) continue;
    const href = new URL(link.getAttribute("href"), SALES_URL).href;
    if (!href.includes("steamcommunity.com")) continue;

    let card = heading.parentElement;
    let cardText = cleanText(card?.textContent);
    for (let depth = 0; depth < 5 && card?.parentElement; depth += 1) {
      if (cardText.length >= 28 && cardText.length <= 700 && /\\b(january|february|march|april|may|june|july|august|september|october|november|december)\\b/i.test(cardText)) break;
      card = card.parentElement;
      cardText = cleanText(card.textContent);
    }

    const dateMatch = cardText.match(/(?:\\d{1,2}\\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)[^,;]{0,55}(?:\\d{4})?/i);
    const image = card?.querySelector("img");
    const live = /\\bLIVE\\b/i.test(cardText);
    const title = headingText.replace(/\\s+LIVE\\s*$/i, "").trim();

    events.push({
      id: href,
      title,
      url: href,
      date: dateMatch?.[0] || "",
      image: image?.getAttribute("src") || image?.getAttribute("data-src") || "",
      status: live ? "live" : section,
      details: cardText.replace(title, "").trim()
    });
  }

  const unique = new Map();
  for (const event of events) {
    const key = event.url;
    if (!unique.has(key)) unique.set(key, event);
    else if (event.status === "upcoming" || event.status === "live") unique.set(key, event);
  }

  return [...unique.values()];
}

export function useSalesData() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async (force = false) => {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (cached?.events?.length && Date.now() - cached.savedAt < CACHE_MAX_AGE) {
          setEvents(cached.events);
          setLastUpdated(cached.savedAt);
          setLoading(false);
          return;
        }
      } catch {}
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(SALES_URL, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error(`SteamDB returned HTTP ${response.status}`);
      const html = await response.text();
      const nextEvents = extractEvents(html);
      if (!nextEvents.length) throw new Error("SteamDB page structure could not be recognized.");
      const savedAt = Date.now();
      setEvents(nextEvents);
      setLastUpdated(savedAt);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ events: nextEvents, savedAt }));
    } catch (err) {
      setError(err.message || "Could not load SteamDB events. Check your CORS extension and try again.");
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (cached?.events?.length) {
          setEvents(cached.events);
          setLastUpdated(cached.savedAt);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { events, loading, error, lastUpdated, refresh };
}
