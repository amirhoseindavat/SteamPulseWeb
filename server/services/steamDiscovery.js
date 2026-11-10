import { decodeSteamHtml } from "../utils/steamHtml.js";

export async function fetchSteamPreorders(cc) {
  // Steam sorts paid upcoming games from highest to lowest price.
  // Once the first row without a real price appears, all following rows are ignored.
  const url = new URL("https://store.steampowered.com/search/results?sort_by=Price_DESC&force_infinite=1&hwtype=0&category1=998&filter=popularcomingsoon&ndl=1&snr=1_7_7_popularcomingsoon_7");
  url.searchParams.set("cc", String(cc || "US").slice(0, 2).toLowerCase());
  url.searchParams.set("l", "english");

  let payload;
  let html = "";
  let responseContentType = "";
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Match the working standalone C# HttpClient request as closely as possible:
      // only send its browser User-Agent. In particular, do not send AJAX-specific
      // headers or a synthetic Referer; Steam may serve a different result set for them.
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error("Steam Pre-orders search failed (HTTP " + response.status + ")");
      responseContentType = response.headers.get("content-type") || "";
      const responseText = await response.text();
      try {
        payload = JSON.parse(responseText.replace(/^\\uFEFF/, "").trim());
        html = String(payload.results_html || "");
      } catch {
        // Steam may answer the same URL with a complete HTML document rather
        // than the AJAX JSON envelope. Parse result rows from that HTML directly.
        html = responseText;
      }
      if (!html.trim()) throw new Error("Steam Pre-orders response was empty.");
      if (!html.includes("search_result_row") && !payload?.results_html) {
        throw new Error("Steam returned HTML instead of search results (content-type: " +
          responseContentType + ", preview: " + html.slice(0, 180).replace(/\\s+/g, " ") + ").");
      }
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  if (!html.trim()) throw new Error(lastError?.message || "Steam Pre-orders search failed.");

  // The full Steam page contains scripts and other links before the actual
  // results. Only parse anchors inside the explicit List Items section.
  const listStart = html.indexOf("<!-- List Items -->");
  const listEnd = listStart >= 0
    ? html.indexOf("<!-- End List Items -->", listStart + "<!-- List Items -->".length)
    : -1;
  const listHtml = listStart >= 0
    ? html.slice(listStart + "<!-- List Items -->".length, listEnd >= 0 ? listEnd : undefined)
    : html;
  const rows = listHtml.match(/<a\b(?=[^>]*\bclass=["'][^"']*\bsearch_result_row\b)[^>]*>[\s\S]*?<\/a>/gi) || [];
  const items = new Map();

  const getAttribute = (source, name) => {
    const match = source.match(new RegExp("\\b" + name + "=(?:\\x22([^\\x22]*)\\x22|'([^']*)')", "i"));
    return match?.[1] || match?.[2] || "";
  };
  const getClassContent = (source, className) => {
    const opening = source.match(new RegExp("<(div|span)\\b(?=[^>]*\\bclass=[\\x22'][^\\x22']*\\b" + className + "\\b)[^>]*>", "i"));
    if (!opening) return "";
    const tag = opening[1];
    const startIndex = source.indexOf(opening[0]) + opening[0].length;
    const close = new RegExp("</" + tag + "\\s*>", "ig");
    close.lastIndex = startIndex;
    const match = close.exec(source);
    return match ? source.slice(startIndex, match.index) : "";
  };

  const parseReleaseDate = (value) => {
    const text = String(value || "").trim();
    if (!text || /coming soon|to be announced|tba|待定/i.test(text)) return Number.POSITIVE_INFINITY;

    const quarter = text.match(/\bQ([1-4])\s*(?:,|of)?\s*(20\d{2})\b/i);
    if (quarter) return Date.UTC(Number(quarter[2]), (Number(quarter[1]) - 1) * 3, 1);

    const yearOnly = text.match(/\b(20\d{2})\b/);
    if (/^\s*20\d{2}\s*$/.test(text)) return Date.UTC(Number(yearOnly[1]), 0, 1);

    const timestamp = Date.parse(text);
    return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
  };

  for (const row of rows) {
    const id = Number((getAttribute(row, "data-ds-appid") || getAttribute(row, "data-appid")).split(",")[0]);
    if (!Number.isSafeInteger(id) || id <= 0) continue;

    const titleHtml = getClassContent(row, "title");
    const name = decodeSteamHtml(titleHtml).trim();
    if (!name) continue;

    // Steam provides a machine-readable minor-unit price on the price
    // wrapper (e.g. data-price-final="6999") and a localized visible label.
    // Prefer that numeric attribute; it works across every currency/locale.
    const priceWrapper = row.match(/<(?:div|span)\b(?=[^>]*\bclass=["'][^"']*(?:search_price_discount_combined|discount_block)[^"']*["'])[^>]*>/i)?.[0] || "";
    const priceContainer = row.match(/<div\b(?=[^>]*\bclass=["'][^"']*\bsearch_price_discount_combined\b[^"']*["'])[^>]*>/i)?.[0] || "";
    const priceAttribute = getAttribute(priceWrapper, "data-price-final") ||
      getAttribute(priceContainer, "data-price-final");
    const visiblePriceHtml = getClassContent(row, "discount_final_price");
    const visiblePrice = decodeSteamHtml(visiblePriceHtml).trim();
    const numericPrice = Number(priceAttribute);
    const hasNumericPrice = priceAttribute !== "" && Number.isFinite(numericPrice) && numericPrice > 0;
    const hasVisiblePrice = Boolean(visiblePrice) &&
      !/^free$/i.test(visiblePrice) &&
      !/price unavailable|not available|coming soon|to be announced/i.test(visiblePrice);
    const hasPrice = hasNumericPrice || hasVisiblePrice;
    const price = visiblePrice || (hasNumericPrice ? priceAttribute : "");

    // Steam's Price_DESC ordering puts unpriced/free entries after priced entries.
    // Stop immediately at the first row without a paid price, as requested.
    if (!hasPrice) break;

    const image = getAttribute(row, "src") || getAttribute(row, "data-src") ||
      row.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1] || "";
    const releaseDate = decodeSteamHtml(getClassContent(row, "search_released")).trim();

    if (!items.has(id)) {
      items.set(id, {
        id,
        name,
        type: "game",
        image: image.replace(/&amp;/g, "&"),
        releaseDate,
        price,
        badge: "PRE-ORDER",
        _releaseSort: parseReleaseDate(releaseDate)
      });
    }
  }

  if (!items.size) {
    throw new Error("Steam Pre-orders search returned no priced games before the first unpriced result " +
      "(success: " + String(payload?.success ?? "HTML response") +
      ", total_count: " + String(payload?.total_count ?? "unknown") +
      ", content-type: " + responseContentType +
      ", rows: " + rows.length +
      ", HTML length: " + html.length +
      ", list marker found: " + (listStart >= 0) +
      ", list rows: " + rows.length +
      ", first row: " + (rows[0] ? decodeSteamHtml(rows[0]).slice(0, 300) : "none") +
      ", sample: " + html.slice(0, 500).replace(/\s+/g, " ") + ").");
  }

  const result = [...items.values()]
    .sort((a, b) => a._releaseSort - b._releaseSort)
    .map(({ _releaseSort, ...item }) => item);

  console.info("Steam Pre-orders: retained " + result.length + " priced games and sorted by release date");
  return result;
}

function extractSteamTakeover(html = "") {
  const source = String(html || "").replace(/\\u002f/gi, "/").replace(/\\\//g, "/");
  const candidates = [];
  const openingTags = /<([a-z][\w:-]*)\b[^>]*(?:class|id|data-[\w-]+)\s*=\s*["'][^"']*takeover[^"']*["'][^>]*>/gi;
  for (const match of source.matchAll(openingTags)) {
    const tag = match[1].toLowerCase();
    const opening = match[0];
    const start = match.index;
    let end = start + opening.length;
    if (!/\/>$/.test(opening)) {
      const token = new RegExp("<\\/?"+tag+"\\b[^>]*>", "gi");
      token.lastIndex = end;
      let depth = 1;
      let next;
      while ((next = token.exec(source))) {
        if (/^<\//.test(next[0])) depth--;
        else if (!/\/>$/.test(next[0])) depth++;
        if (depth === 0) { end = token.lastIndex; break; }
      }
      if (depth !== 0) continue;
    }
    candidates.push({ tag, html: source.slice(start, end), opening });
  }
  const attr = (text, name) => {
    const match = text.match(new RegExp("\\b" + name + "=[\\x22']([^\\x22']*)[\\x22']", "i"));
    return match?.[1] || "";
  };
  const absolute = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value.replace(/&amp;/g, "&"), "https://store.steampowered.com/");
      return /^https?:$/.test(url.protocol) ? url.toString() : "";
    } catch { return ""; }
  };
  for (const candidate of candidates) {
    const block = candidate.html;
    const anchor = candidate.tag === "a" ? candidate.opening : block.match(/<a\b[^>]*>/i)?.[0] || "";
    const imageTag = block.match(/<(?:img|source)\b[^>]*>/i)?.[0] || "";
    const videoTag = block.match(/<video\b[^>]*>/i)?.[0] || "";
    const link = absolute(attr(anchor, "href") || attr(candidate.opening, "data-url") || attr(candidate.opening, "data-href"));
    const videoSourceTag = block.match(/<source\b[^>]*>/i)?.[0] || "";
    let image = attr(videoTag, "src") || attr(videoSourceTag, "src") ||
      attr(imageTag, "src") || attr(imageTag, "data-src") || attr(imageTag, "data-original") ||
      attr(videoTag, "poster") || attr(candidate.opening, "data-image") || attr(candidate.opening, "data-background");
    if (!image) {
      const srcset = attr(imageTag, "srcset");
      if (srcset) image = srcset.split(",")[0].trim().split(/\s+/)[0];
    }
    if (!image) image = block.match(/background(?:-image)?\s*:\s*url\(["']?([^"')]+)["']?\)/i)?.[1] || "";
    image = absolute(image);
    const title = decodeSteamHtml(
      attr(candidate.opening, "data-title") || attr(anchor, "aria-label") ||
      attr(anchor, "title") || attr(imageTag, "alt") ||
      block.match(/<(?:h1|h2|h3)\b[^>]*>([\s\S]*?)<\/(?:h1|h2|h3)>/i)?.[1] || ""
    );
    if (!image || !link) continue;
    return { title: title || "Steam Store Takeover", image, link, mediaType: /\.(?:mp4|webm|m4v|mov|ogv)(?:[?#]|$)/i.test(image) ? "video" : "image" };
  }
  return null;
}

export async function fetchSteamTakeover(cc) {
  const url = new URL("https://store.steampowered.com/");
  url.searchParams.set("cc", String(cc || "US").slice(0, 2).toLowerCase());
  url.searchParams.set("l", "english");
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Steam homepage request failed (" + response.status + ")");
  return extractSteamTakeover(await response.text());
}

export async function fetchSteamTopSellers(cc) {
