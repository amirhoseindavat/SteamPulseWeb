export function registerDiscoveryRoutes(app, { fetchJson, fetchJsonWithOptions, cached, saveCache, CACHE_TTL, mapWithConcurrency }) {
app.get("/api/search", async (req, res) => {
  const term = String(req.query.term || "").trim();
  const cc = String(req.query.cc || "US").slice(0, 2).toUpperCase();
  const lang = String(req.query.l || "english").slice(0, 30);

  if (term.length < 2) return res.json({ items: [] });

  const key = `search:${cc}:${lang}:${term.toLowerCase()}`;
  const hit = cached(key);
  if (hit) return res.json(hit);

  try {
    const url = new URL("https://store.steampowered.com/api/storesearch/");
    url.searchParams.set("term", term);
    url.searchParams.set("l", lang);
    url.searchParams.set("cc", cc);

    const data = await fetchJson(url);
    const items = (data.items || [])
      .map((item) => ({
        id: Number(item.id),
        name: item.name,
        tiny_image: item.tiny_image || "",
        type: item.type || "game",
        price: item.price || null
      }))
      .filter((item) => Number.isFinite(item.id) && item.name);

    res.json(saveCache(key, { items }));
  } catch (error) {
    console.error("Steam search failed:", error);
    res.status(502).json({
      error: "Steam search is temporarily unavailable.",
      detail: error.message
    });
  }
});

function cleanEditionName(value) {
  return String(value || "")
    .replace(/<span[^>]*discount_original_price[^>]*>[\s\S]*?<\/span>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s*[\d][\d\s.,]*(?:₴|\$|€|£|USD|EUR|GBP|UAH|RUB|TRY|PLN|BRL|INR)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s–—-]+$/g, "")
    .replace(/^\s*[-–—:]+\s*|\s*[-–—:]+\s*$/g, "")
    .trim();
}

function extractSteamBundleIds(html = "") {
  const normalized = String(html)
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&#x2f;|&#47;|&sol;/gi, "/")
    .replace(/\\u0022/gi, '"')
    .replace(/\\"/g, '"');

  const ids = new Set();
  const add = (value) => {
    const id = Number(value);
    if (Number.isSafeInteger(id) && id > 0) ids.add(id);
  };

  for (const match of normalized.matchAll(/\/bundle\/(\d+)/gi)) add(match[1]);
  for (const match of normalized.matchAll(/(?:data-ds-bundleid|data-bundleid|bundleid|bundle_id)\s*(?:=|:)\s*["']?(\d+)/gi)) add(match[1]);
  for (const match of normalized.matchAll(/["']bundleids?["']\s*:\s*\[([^\]]+)\]/gi)) {
    for (const id of match[1].matchAll(/\d+/g)) add(id[0]);
  }
  return [...ids];
}


function extractSteamFranchise(html) {
  const anchorMatch = String(html || "").match(/<a\b(?=[^>]*\bclass=["'][^"']*\bfranchise_notice\b[^"']*["'])[^>]*>[\s\S]*?<\/a>/i);
  if (!anchorMatch) return null;

  const anchor = anchorMatch[0];
  const href = anchor.match(/\bhref=["']([^"']+)["']/i)?.[1];
  const name = anchor.match(/<div\b(?=[^>]*\bclass=["'][^"']*\bfranchise_name\b)[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const background = anchor.match(/<div\b(?=[^>]*\bclass=["'][^"']*\bbackground_image\b)[^>]*\bstyle=["'][^"']*background-image\s*:\s*url\((['"]?)(.*?)\1\)[^"']*["']/i)?.[2];
  if (!href || !name) return null;

  const clean = (value) => decodeSteamHtml(value).trim();
  const url = clean(href);
  if (!/^https?:\/\/store\.steampowered\.com\/franchise\//i.test(url)) return null;
  return { url, name: clean(name).replace(/\s+/g, " "), image: background ? clean(background) : "" };
}

async function fetchSteamBundles(appid, cc) {
  const startedAt = Date.now();
  const currency = cc === "GB" ? "GBP" : cc === "DE" ? "EUR" : cc === "TR" ? "TRY" : cc === "PL" ? "PLN" : cc === "BR" ? "BRL" : cc === "IN" ? "INR" : cc === "UA" ? "UAH" : cc === "AR" ? "ARS" : "USD";
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/json, */*",
    "Accept-Language": "en-US,en;q=0.9"
  };

  // Steam's mature-game Age Gate otherwise redirects Node fetch between
  // /app/ and /agecheck/ because fetch does not persist browser cookies.
  // These cookies mirror the successful browser-style age confirmation.
  const steamStoreHeaders = {
    ...headers,
    Cookie: "birthtime=631152001; lastagecheckage=1-January-1990; wants_mature_content=1"
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const pageUrl = new URL("https://store.steampowered.com/app/" + appid + "/");
      pageUrl.searchParams.set("cc", cc);
      pageUrl.searchParams.set("l", "english");

      // Treat the app page and bundles listing as independent discovery sources.
      // Steam can fail one route while the other remains reachable.
      let appIds = [];
      let franchise = null;
      let appPageStatus = "error";
      try {
        const appResponse = await fetch(pageUrl, { headers: steamStoreHeaders, signal: AbortSignal.timeout(15000) });
        appPageStatus = appResponse.status;
        if (appResponse.ok) {
          const appHtml = await appResponse.text();
          appIds = extractSteamBundleIds(appHtml);
          franchise = extractSteamFranchise(appHtml);
        }
      } catch (appPageError) {
        console.warn("[SteamPulse bundles] AppID " + appid + ": app page request failed: " + appPageError.message);
      }

      let listingIds = [];
      let listingStatus = "unavailable";
      try {
        const listingUrl = new URL("https://store.steampowered.com/app/" + appid + "/bundles/");
        listingUrl.searchParams.set("cc", cc);
        listingUrl.searchParams.set("l", "english");
        const listingResponse = await fetch(listingUrl, { headers: steamStoreHeaders, signal: AbortSignal.timeout(12000) });
        listingStatus = listingResponse.status;
        if (listingResponse.ok) listingIds = extractSteamBundleIds(await listingResponse.text());
      } catch (listingError) {
        listingStatus = "error";
        console.warn("[SteamPulse bundles] AppID " + appid + ": listing request failed: " + listingError.message);
      }

      const bundleIds = [...new Set([...appIds, ...listingIds])].slice(0, 40);
      console.info("[SteamPulse bundles] AppID " + appid + " cc=" + cc + " attempt=" + attempt + ": appPageStatus=" + appPageStatus + ", appIds=" + appIds.length + ", listingIds=" + listingIds.length + ", listingStatus=" + listingStatus + ", uniqueIds=" + bundleIds.length);

      if (!bundleIds.length) {
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          continue;
        }
        console.warn("[SteamPulse bundles] AppID " + appid + ": no bundle IDs discovered after 2 attempts (" + (Date.now() - startedAt) + "ms)");
        return { bundles: [], franchise };
      }

      const bundleUrl = new URL("https://store.steampowered.com/actions/ajaxresolvebundles");
      bundleUrl.searchParams.set("bundleids", bundleIds.join(","));
      bundleUrl.searchParams.set("cc", cc);
      bundleUrl.searchParams.set("l", "english");
      const resolved = await fetchJsonWithOptions(bundleUrl, {
        headers: { ...steamStoreHeaders, "Referer": pageUrl.toString(), "X-Requested-With": "XMLHttpRequest" },
        signal: AbortSignal.timeout(15000)
      });

      const bundlePayload = Array.isArray(resolved) ? resolved
        : Array.isArray(resolved?.bundles) ? resolved.bundles
          : Array.isArray(resolved?.bundle_data) ? resolved.bundle_data
            : Array.isArray(resolved?.data) ? resolved.data
              : resolved;
      const rawBundles = Array.isArray(bundlePayload)
        ? bundlePayload
        : bundlePayload && typeof bundlePayload === "object"
          ? Object.entries(bundlePayload).filter(([, value]) => value && typeof value === "object")
            .map(([id, bundle]) => ({ ...bundle, bundleid: bundle.bundleid || bundle.bundle_id || bundle.id || id }))
          : [];

      const byId = new Map();
      for (const bundle of rawBundles) {
        const id = Number(bundle?.bundleid || bundle?.bundle_id || bundle?.id);
        if (!bundle || !bundleIds.includes(id)) continue;
        byId.set(id, bundle);
      }

      const bundles = bundleIds
        .filter((id) => byId.has(id))
        .map((id) => {
          const bundle = byId.get(id);
          const finalPrice = bundle.final_price ?? bundle.price;
          const originalPrice = bundle.original_price ?? bundle.initial_price;
          const finalValue = finalPrice != null && Number.isFinite(Number(finalPrice)) ? Number(finalPrice) / 100 : null;
          const originalValue = originalPrice != null && Number.isFinite(Number(originalPrice)) ? Number(originalPrice) / 100 : null;
          // Steam's bundle discount_percent can be stale or inconsistent with
          // the actual prices. Derive it from the original and final prices.
          const savings = originalValue != null && finalValue != null && originalValue > 0
            ? (finalValue < originalValue
              ? String(Math.round((1 - finalValue / originalValue) * 100))
              : "")
            : (bundle.discount_percent != null ? String(bundle.discount_percent) : "");
          return {
            id,
            name: bundle.name || bundle.bundle_name || "Steam Bundle",
            image: bundle.header_image_url || bundle.header_image || bundle.main_capsule || "",
            priceValue: finalValue,
            price: bundle.formatted_final_price || bundle.price_formatted || (finalValue != null
              ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(finalValue)
              : null),
            originalPrice: bundle.formatted_original_price || (originalValue != null
              ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(originalValue)
              : null),
            savings,
            appCount: Array.isArray(bundle.appids) ? bundle.appids.length : null,
            url: "https://store.steampowered.com/bundle/" + id + "/"
          };
        });

      console.info("[SteamPulse bundles] AppID " + appid + " cc=" + cc + ": requestedIds=" + bundleIds.length + ", resolvedBundles=" + bundles.length + ", rawItems=" + rawBundles.length + ", duration=" + (Date.now() - startedAt) + "ms");
      if (!bundles.length) console.warn("[SteamPulse bundles] AppID " + appid + ": Steam returned no resolvable bundle data for discovered IDs.");
      return { bundles, franchise };
    } catch (error) {
      if (attempt === 1) {
        console.warn("[SteamPulse bundles] AppID " + appid + " attempt 1 failed; retrying: " + error.message);
        await new Promise((resolve) => setTimeout(resolve, 700));
      } else {
        console.warn("[SteamPulse bundles] AppID " + appid + " failed after 2 attempts (" + (Date.now() - startedAt) + "ms): " + error.message);
      }
    }
  }
  return { bundles: [], franchise: null };
}

function decodeSteamHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}


async function fetchSteamPreorders(cc) {
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
async function fetchSteamTopSellers(cc) {
  const url = new URL("https://store.steampowered.com/search/results/");
  url.searchParams.set("query", "");
  url.searchParams.set("start", "0");
  url.searchParams.set("count", "50");
  url.searchParams.set("dynamic_data", "");
  url.searchParams.set("sort_by", "_ASC");
  url.searchParams.set("snr", "1_7_7_7000_7");
  url.searchParams.set("filter", "topsellers");
  url.searchParams.set("category1", "998");
  url.searchParams.set("os", "win");
  url.searchParams.set("cc", cc.toLowerCase());
  url.searchParams.set("l", "english");
  url.searchParams.set("infinite", "1");

  let response;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest"
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error("Steam Top Sellers search failed (" + response.status + ")");
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  if (!response?.ok) throw lastError || new Error("Steam Top Sellers search failed");
  const payload = await response.json();
  const html = String(payload.results_html || "");
  const rows = html.match(/<a\b[^>]*class=["'][^"']*search_result_row[^"']*["'][\s\S]*?<\/a>/gi) || [];

  const getClassContent = (source, className) => {
    const elements = source.match(/<(?:div|span)\b[^>]*class=["'][^"']*["'][^>]*>[\s\S]*?<\/(?:div|span)>/gi) || [];
    const element = elements.find((part) => {
      const classAttr = part.match(/\bclass=["']([^"']*)["']/i)?.[1] || "";
      return classAttr.split(/\s+/).includes(className);
    });
    if (!element) {
      const openingTag = source.match(new RegExp('<(?:div|span)\\b(?=[^>]*\\bclass="[^"]*\\b' + className + '\\b)[^>]*>', "i"))?.[0];
      if (!openingTag) return "";
      const start = source.indexOf(openingTag) + openingTag.length;
      const tag = openingTag.match(/^<([a-z]+)/i)?.[1] || "div";
      const close = new RegExp("</" + tag + "\\s*>", "ig");
      close.lastIndex = start;
      const match = close.exec(source);
      return match ? source.slice(start, match.index) : "";
    }
    return element.replace(/^<(?:div|span)\b[^>]*>/i, "").replace(/<\/(?:div|span)>$/i, "");
  };

  return rows.map((row) => {
    const attr = (name) => {
      const doubleQuoted = row.match(new RegExp(name + '="([^"]*)"', "i"));
      const singleQuoted = row.match(new RegExp(name + "='([^']*)'", "i"));
      return doubleQuoted?.[1] || singleQuoted?.[1] || "";
    };
    const id = Number(attr("data-ds-appid").split(",")[0]);
    const title = row.match(/<span[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || "";
    const image = row.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";

    const finalPriceHtml = getClassContent(row, "discount_final_price");
    const originalPriceHtml = getClassContent(row, "discount_original_price");
    const discountPercentHtml = getClassContent(row, "discount_pct");
    const releaseDateHtml = getClassContent(row, "search_released");
    const priceContainer = row.match(/<div[^>]*class=["'][^"']*search_price[^"']*["'][^"']*>([\s\S]*?)<\/div>\s*<\/a>/i)?.[1] || "";
    const discountPercent = Number(decodeSteamHtml(discountPercentHtml).replace(/[^0-9]/g, "")) || 0;
    const finalPriceText = decodeSteamHtml(finalPriceHtml);
    const containerText = decodeSteamHtml(priceContainer);
    const currencyPricePattern = /(?:[$€£₴]|USD|EUR|GBP|UAH|RUB|TRY|PLN|BRL|INR)\s*\d|\d[\d.,\s]*\s*(?:[$€£₴]|USD|EUR|GBP|UAH|RUB|TRY|PLN|BRL|INR)/i;
    const isFree = /\bfree(?: to play)?\b/i.test(containerText);
    if (!Number.isFinite(id) || id <= 0 || !title || isFree) return null;

    const price = currencyPricePattern.test(finalPriceText)
      ? finalPriceText
      : currencyPricePattern.test(containerText) && !/pre[ -]?purchase/i.test(containerText)
        ? containerText
        : "Price unavailable";
    const hasValidPrice = price !== "Price unavailable";
    return {
      id,
      name: decodeSteamHtml(title),
      type: "game",
      image: image.replace(/&amp;/g, "&"),
      releaseDate: decodeSteamHtml(releaseDateHtml),
      price,
      originalPrice: decodeSteamHtml(originalPriceHtml || ""),
      discountPercent: hasValidPrice ? discountPercent : 0,
      priceValue: isFree ? 0 : null,
      badge: "TOP SELLER"
    };
  }).filter(Boolean);
}

app.get("/api/top-sellers", async (req, res) => {
  const cc = String(req.query.cc || "US").slice(0, 2).toUpperCase();
  const key = `top-sellers:v1:${cc}`;
  if (req.query.refresh !== "1") {
    const hit = cached(key);
    if (hit) return res.json(hit);
  }

  try {
    const [fullList, featuredData] = await Promise.all([
      fetchSteamTopSellers(cc).catch((error) => {
        console.warn("Could not load Steam Top Sellers search:", error.message);
        return [];
      }),
      fetchJson(new URL(`https://store.steampowered.com/api/featuredcategories/?cc=${cc}&l=english`)).catch((error) => {
        console.warn("Could not load featured Top Sellers fallback:", error.message);
        return null;
      })
    ]);

    const featuredItems = (featuredData?.top_sellers?.items || [])
      .filter((item) => Number(item.id) > 0 && item.name)
      .map((item) => ({
        id: Number(item.id),
        name: item.name,
        type: "game",
        image: item.large_capsule_image || item.header_image || item.small_capsule_image || "",
        priceValue: item.final_price != null ? Number(item.final_price) / 100 : null,
        price: item.final_formatted || "",
        originalPrice: item.original_price != null && item.currency
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: item.currency }).format(Number(item.original_price) / 100)
          : "",
        discountPercent: Number(item.discount_percent) || 0,
        badge: "TOP SELLER"
      }));

    const unique = new Map();
    for (const item of [...fullList, ...featuredItems]) {
      if (!item?.id || !item.name || unique.has(Number(item.id))) continue;
      const hasPaidPrice = item.priceValue != null
        ? Number(item.priceValue) > 0
        : Boolean(String(item.price || "").trim()) &&
          !/\bfree(?:\s+to\s+play)?\\b|price unavailable|not available/i.test(String(item.price));
      if (hasPaidPrice) unique.set(Number(item.id), { ...item, badge: "TOP SELLER" });
    }

    const items = [...unique.values()].slice(0, 50);
    if (!items.length) throw new Error("Steam did not return any priced Top Sellers.");
    res.json(saveCache(key, { items }));
  } catch (error) {
    console.error("Steam Top Sellers request failed:", error);
    res.status(502).json({ error: "Steam Top Sellers are temporarily unavailable.", detail: error.message });
  }
});

app.get("/api/discover", async (req, res) => {
  const cc = String(req.query.cc || "US").slice(0, 2).toUpperCase();
  const key = `discover:v26:${cc}`;
  if (req.query.refresh !== "1") {
    const hit = cached(key);
    if (hit) return res.json(hit);
  }

  try {
    const url = new URL("https://store.steampowered.com/api/featuredcategories/");
    url.searchParams.set("cc", cc);
    url.searchParams.set("l", "english");
    const data = await fetchJson(url);
    // Steam's featured-categories feed can contain hardware and other non-game products.
    // Exclude known Steam/Valve hardware by name as a lightweight fallback when appdetails
    // is rate-limited, so hardware listings never leak into game discovery.
    const nonGameHardwareName = /\\b(?:steam\\s*(?:deck|frame|controller|machine|link)|valve\\s*index|index\\s*(?:vr|controllers?))\\b/i;
    const normalize = async (items, badge) => {
      const candidates = (items || []).filter((item) =>
        Number(item.id) > 0 &&
        item.name &&
        !nonGameHardwareName.test(String(item.name))
      );
      const checked = await mapWithConcurrency(candidates, 4, async (item) => {
        const type = String(item.type || "").toLowerCase();
        if (type && type !== "game") return null;
        if (type === "game") return item;
        const detailUrl = new URL("https://store.steampowered.com/api/appdetails");
        detailUrl.searchParams.set("appids", String(item.id));
        detailUrl.searchParams.set("cc", cc);
        detailUrl.searchParams.set("l", "english");
        try {
          const details = await fetchJson(detailUrl);
          const envelope = details?.[item.id] || details?.[String(item.id)];
          // If Steam confirms the app type, only show games. If appdetails is
          // temporarily unavailable/rate-limited, keep the featured-store entry
          // instead of dropping valid trending titles from the whole category.
          if (envelope?.success) {
            return String(envelope.data?.type || "").toLowerCase() === "game" ? item : null;
          }
          return null;
        } catch (error) {
          console.warn(`Steam appdetails check failed for discovery app ${item.id}:`, error.message);
          return item;
        }
      });
      return checked.filter((entry) => entry.status === "fulfilled" && entry.value).map(({ value: item }) => ({
        id: Number(item.id),
        name: item.name,
        type: "game",
        image: item.large_capsule_image || item.header_image || item.small_capsule_image || "",
        priceValue: item.final_price != null ? Number(item.final_price) / 100 : null,
        price: item.final_formatted || (item.final_price != null
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: item.currency || "USD" }).format(Number(item.final_price) / 100)
          : ""),
        releaseDate: item.release_date?.date || item.release_date || "",
        subtitle: item.discount_percent ? `${item.discount_percent}% off` : "",
        badge
      }));
    };

    let preordersError = "";
    const [newReleases, upcoming, featuredTopSellers, fullTopSellers, preordersFromSteam] = await Promise.all([
      normalize(data?.new_releases?.items, "NEW"),
      normalize(data?.coming_soon?.items, "UPCOMING"),
      normalize(data?.top_sellers?.items, "TOP SELLER"),
      fetchSteamTopSellers(cc).catch((error) => {
        console.warn("Could not load the full Steam Top Sellers list:", error.message);
        return [];
      }),
      fetchSteamPreorders(cc).catch((error) => {
        preordersError = error.message || String(error);
        console.error("Could not load Steam Popular Upcoming page:", preordersError);
        return [];
      })
    ]);
    // The homepage featured-categories API only returns a short Top Sellers
    // selection. The search-results endpoint exposes the full ranked list.
    // Merge both sources by AppID so valid titles are not lost if one source
    // omits an item or temporarily returns an incomplete page.
    const topSellerMap = new Map();
    for (const item of [...fullTopSellers, ...featuredTopSellers]) {
      if (item?.id && !topSellerMap.has(Number(item.id))) {
        topSellerMap.set(Number(item.id), { ...item, badge: "TOP SELLER" });
      }
    }
    const hasPaidPrice = (item) => {
      if (item.priceValue != null && Number.isFinite(Number(item.priceValue))) {
        return Number(item.priceValue) > 0;
      }
      const price = String(item.price || "").trim();
      if (!price || /\bfree(?:\s+to\s+play)?\b|price unavailable|not available/i.test(price)) return false;
      const match = price.match(/(?:[$€£₴]|USD|EUR|GBP|UAH|RUB|TRY|PLN|BRL|INR)\s*([\d.,]+)|([\d.,]+)\s*(?:[$€£₴]|USD|EUR|GBP|UAH|RUB|TRY|PLN|BRL|INR)/i);
      return Boolean(match && Number((match[1] || match[2]).replace(/[.,]/g, "")) > 0);
    };
    // Top Sellers must contain purchasable games only; featured-category
    // entries can otherwise leak in with a zero or missing price.
    const topSellers = [...topSellerMap.values()].filter(hasPaidPrice).slice(0, 50);
    // Steam's popularcomingsoon search filter supplies the preorder/upcoming results.
    const preorders = preordersFromSteam;
    const result = { newReleases, upcoming, preorders, preordersError, topSellers };
    if (!result.newReleases.length && !result.upcoming.length && !result.topSellers.length) {
      return res.status(502).json({ error: "Steam returned no discovery categories. Please try again shortly." });
    }
    res.json(saveCache(key, result));
  } catch (error) {
    console.error("Steam discovery failed:", error);
    res.status(502).json({ error: "Steam game discovery is temporarily unavailable.", detail: error.message });
  }
});

app.get("/api/free-games", async (req, res) => {
  const cc = String(req.query.cc || "US").slice(0, 2).toUpperCase();
  const key = `free-games:${cc}`;
  if (req.query.refresh !== "1") {
    const hit = cached(key);
    if (hit) return res.json(hit);
  }

  try {
    // Use Steam's own search page for limited-time free promotions.
    // specials=1 + maxprice=free filters the results to free discounted offers,
    // while supportedlang keeps the results relevant to English/Persian users.
    const searchUrl = new URL("https://store.steampowered.com/search/");
    searchUrl.searchParams.set("hwtype", "0");
    searchUrl.searchParams.set("maxprice", "free");
    searchUrl.searchParams.set("supportedlang", "english,persian");
    searchUrl.searchParams.set("specials", "1");
    searchUrl.searchParams.set("ndl", "1");
    searchUrl.searchParams.set("cc", cc);
    searchUrl.searchParams.set("l", "english");

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`Steam free-offer search failed (${response.status})`);
    const html = await response.text();
    const cleanText = (value) => String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/\s+/g, " ").trim();

    // Steam search results are rendered as individual search_result_row anchors.
    const rows = [...html.matchAll(/<a\b[^>]*class=["'][^"']*search_result_row[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)]
      .map((match) => match[0]);
    const candidates = [];
    for (const row of rows) {
      const idMatch = row.match(/data-ds-appid=["'](\d+)["']/i)
        || row.match(/\/app\/(\d+)/i);
      const nameMatch = row.match(/<span[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
        || row.match(/<span[^>]*class=["'][^"']*search_name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      if (!idMatch) continue;
      const id = Number(idMatch[1]);
      const name = cleanText(nameMatch?.[1] || "");
      if (!id || !name || candidates.some((item) => item.id === id)) continue;

      // The search page should be limited-time promotions, not the whole free-to-play catalogue.
      const originalPrice = row.match(/discount_original_price[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
      const finalPrice = row.match(/discount_final_price[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
      const rowText = cleanText(row).toLowerCase();
      const looksLikeZeroPriceOffer = /(?:^|\s)free(?:\s|$)/i.test(cleanText(finalPrice)) || /play for free|free to keep/i.test(rowText);
      const hasOriginalPrice = Boolean(cleanText(originalPrice));
      if (!looksLikeZeroPriceOffer && !hasOriginalPrice) continue;

      candidates.push({
        id,
        name,
        image: row.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] || "",
        rowText,
        originalPrice: cleanText(originalPrice),
        finalPrice: cleanText(finalPrice)
      });
    }

    const checked = await mapWithConcurrency(candidates.slice(0, 30), 4, async (candidate) => {
      const detailUrl = new URL("https://store.steampowered.com/api/appdetails");
      detailUrl.searchParams.set("appids", String(candidate.id));
      detailUrl.searchParams.set("cc", cc);
      detailUrl.searchParams.set("l", "english");
      const details = await fetchJson(detailUrl);
      const envelope = details?.[String(candidate.id)];
      if (!envelope?.success || !["game", "dlc"].includes(String(envelope.data?.type || "").toLowerCase())) return null;

      const game = envelope.data;
      const price = game.price_overview;
      const zeroNow = Boolean(game.is_free) || (price && Number(price.final) === 0);
      const hadPaidPrice = Boolean(price && Number(price.initial) > 0);
      const text = candidate.rowText;
      let offerType = "";
      if (/free to keep|keep forever|free to own/i.test(text) || (zeroNow && hadPaidPrice)) {
        offerType = "FREE TO KEEP";
      } else if (/play for free|free weekend|free weekend/i.test(text)) {
        offerType = "FREE WEEKEND";
      }

      // Exclude permanently free-to-play products, but include qualifying free game and DLC promotions.
      if (!offerType) return null;
      return {
        id: candidate.id,
        name: game.name || candidate.name,
        offerType,
        productType: String(game.type || "game").toLowerCase(),
        expires: "",
        image: game.header_image || candidate.image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${candidate.id}/header.jpg`,
        url: `https://store.steampowered.com/app/${candidate.id}/?cc=${cc}`,
        releaseDate: game.release_date?.date || "",
        originalPrice: price?.initial_formatted || candidate.originalPrice || "",
        currentPrice: price?.final_formatted || candidate.finalPrice || "Free"
      };
    });
    const items = checked
      .filter((entry) => entry.status === "fulfilled" && entry.value)
      .map((entry) => entry.value);
    const result = { items, source: "Steam Store", sourceUrl: searchUrl.toString() };
    res.json(saveCache(key, result));
  } catch (error) {
    console.error("Steam free promotions failed:", error);
    res.status(502).json({
      error: "Current free Steam promotions are temporarily unavailable.",
      detail: error.message
    });
  }
});
  return { fetchSteamBundles, decodeSteamHtml };
}
