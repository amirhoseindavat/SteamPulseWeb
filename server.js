import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
app.use(cors());
app.use(express.json());

const cache = new Map();
const inflightRequests = new Map();
const previousRegionalSellPrices = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const STEAM_REQUEST_TIMEOUT_MS = 10000;

async function fetchJsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.headers || { "User-Agent": "SteamPulseWeb/1.0" },
    signal: options.signal || AbortSignal.timeout(STEAM_REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    const error = new Error(`Steam request failed (${response.status})`);
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }
  return response.json();
}

// Share identical simultaneous requests so repeated UI actions don't multiply Steam traffic.
function fetchJson(url, options = {}) {
  const key = `${String(url)}|json|${options.headers ? JSON.stringify(options.headers) : ""}`;
  if (inflightRequests.has(key)) return inflightRequests.get(key);
  const request = fetchJsonRequest(url, options).finally(() => inflightRequests.delete(key));
  inflightRequests.set(key, request);
  return request;
}

async function fetchJsonWithOptions(url, options = {}) {
  return fetchJson(url, options);
}

async function fetchSteamDbLogo(appid) {
  try {
    const response = await fetch(`https://steamdb.info/app/${encodeURIComponent(appid)}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return "";
    const html = await response.text();

    // SteamDB exposes the hashed filename for library logos even when
    // StoreBrowse omits logo/library_logo from its assets response.
    const match = html.match(new RegExp(`(?:steam/apps/${appid}/)?([a-f0-9]{40}/logo(?:_2x)?\\.png)`, "i"));
    if (!match) return "";
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/${match[1]}`;
  } catch {
    return "";
  }
}

async function fetchSteamHeaderImage(appid) {
  const fallback = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
  try {
    const data = await fetchJson(
      `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appid)}&filters=basic`,
      { headers: { "User-Agent": "Mozilla/5.0 SteamPulseWeb/1.0", "Accept": "application/json" } }
    );
    const app = data?.[String(appid)];
    const image = app?.success ? app?.data?.header_image : "";
    return typeof image === "string" && image.startsWith("https://") ? image : fallback;
  } catch {
    return fallback;
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = { status: "fulfilled", value: await mapper(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function cached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < CACHE_TTL) return entry.value;
  cache.delete(key);
  return null;
}

function saveCache(key, value) {
  cache.set(key, { at: Date.now(), value });
  return value;
}

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

async function fetchSteamBundles(appid, cc) {
  const currency = cc === "GB" ? "GBP" : cc === "DE" ? "EUR" : cc === "TR" ? "TRY" : cc === "PL" ? "PLN" : cc === "BR" ? "BRL" : cc === "IN" ? "INR" : cc === "UA" ? "UAH" : cc === "AR" ? "ARS" : "USD";

  // Bundles are optional. Retry transient network failures without blocking game details.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/json, */*",
        "Accept-Language": "en-US,en;q=0.9"
      };
      const pageUrl = new URL(`https://store.steampowered.com/app/${appid}/`);
      pageUrl.searchParams.set("cc", cc);
      pageUrl.searchParams.set("l", "english");

      const response = await fetch(pageUrl, { headers, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`Steam app page request failed (${response.status})`);

      const html = await response.text();
      const bundleIds = [...new Set([
        ...[...html.matchAll(/(?:store\.steampowered\.com)?\/bundle\/(\d+)/g)].map((m) => Number(m[1])),
        ...[...html.matchAll(/(?:bundleid|bundle_id|bundleid=)["':=\s]+(\d+)/gi)].map((m) => Number(m[1]))
      ])].filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 30);

      if (!bundleIds.length) return [];

      const bundleUrl = new URL("https://store.steampowered.com/actions/ajaxresolvebundles");
      bundleUrl.searchParams.set("bundleids", bundleIds.join(","));
      bundleUrl.searchParams.set("cc", cc);
      bundleUrl.searchParams.set("l", "english");
      const bundles = await fetchJsonWithOptions(bundleUrl, {
        headers: { ...headers, "Referer": pageUrl.toString(), "X-Requested-With": "XMLHttpRequest" },
        signal: AbortSignal.timeout(12000)
      });

      return (Array.isArray(bundles) ? bundles : [])
        .filter((bundle) => Number(bundle.bundleid) > 0 && (bundle.appids || []).map(Number).includes(Number(appid)))
        .map((bundle) => ({
          id: Number(bundle.bundleid),
          name: bundle.name || "Steam Bundle",
          image: bundle.header_image_url || bundle.main_capsule || "",
          priceValue: bundle.final_price != null ? Number(bundle.final_price) / 100 : null,
          price: bundle.formatted_final_price || (bundle.final_price != null ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(bundle.final_price) / 100) : null),
          savings: bundle.discount_percent ? String(bundle.discount_percent) : "",
          appCount: (bundle.appids || []).length,
          url: `https://store.steampowered.com/bundle/${Number(bundle.bundleid)}/`
        }));
    } catch (error) {
      if (attempt === 1) {
        console.warn(`Steam bundles request failed for AppID ${appid}; retrying: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 700));
      } else {
        console.warn(`Could not load Steam bundles for AppID ${appid} after 2 attempts: ${error.message}`);
      }
    }
  }
  return [];
}

app.get("/api/discover", async (req, res) => {
  const cc = String(req.query.cc || "US").slice(0, 2).toUpperCase();
  const key = `discover:${cc}`;
  if (req.query.refresh !== "1") {
    const hit = cached(key);
    if (hit) return res.json(hit);
  }

  try {
    const url = new URL("https://store.steampowered.com/api/featuredcategories/");
    url.searchParams.set("cc", cc);
    url.searchParams.set("l", "english");
    const data = await fetchJson(url);
    // The featured-categories feed can contain hardware and other non-game products.
    // Keep explicitly typed games, reject known non-game types, and verify ambiguous entries
    // against appdetails before showing them in the discovery UI.
    const normalize = async (items, badge) => {
      const candidates = (items || []).filter((item) => Number(item.id) > 0 && item.name);
      const checked = await mapWithConcurrency(candidates, 4, async (item) => {
        const type = String(item.type || "").toLowerCase();
        if (type && type !== "game") return null;
        if (type === "game") return item;
        const detailUrl = new URL("https://store.steampowered.com/api/appdetails");
        detailUrl.searchParams.set("appids", String(item.id));
        detailUrl.searchParams.set("cc", cc);
        detailUrl.searchParams.set("l", "english");
        const details = await fetchJson(detailUrl);
        const envelope = details?.[item.id] || details?.[String(item.id)];
        return envelope?.success && String(envelope.data?.type || "").toLowerCase() === "game" ? item : null;
      });
      return checked.filter((entry) => entry.status === "fulfilled" && entry.value).map(({ value: item }) => ({
        id: Number(item.id),
        name: item.name,
        type: "game",
        image: item.large_capsule_image || item.header_image || item.small_capsule_image || "",
        price: item.final_price != null
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: item.currency || "USD" }).format(Number(item.final_price) / 100)
          : (item.final_formatted || ""),
        releaseDate: item.release_date?.date || item.release_date || "",
        subtitle: item.discount_percent ? `${item.discount_percent}% off` : "",
        badge
      }));
    };

    const [newReleases, upcoming, topSellers] = await Promise.all([
      normalize(data?.new_releases?.items, "NEW"),
      normalize(data?.coming_soon?.items, "UPCOMING"),
      normalize(data?.top_sellers?.items, "TRENDING")
    ]);
    const result = { newReleases, upcoming, topSellers };
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
    // SteamDB tracks both permanent free-to-keep promotions and temporary free weekends.
    const response = await fetch("https://steamdb.info/upcoming/free/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`SteamDB request failed (${response.status})`);
    const html = await response.text();
    const cleanText = (value) => String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).trim();

    const offers = [];
    const cardPattern = /<h4[^>]*>\s*<a[^>]*href=["']\/app\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>[\s\S]{0,1600}?(Free to Keep|Play For Free)[\s\S]{0,500}?Expires:\s*([^<\n]+)/gi;
    for (const match of html.matchAll(cardPattern)) {
      const id = Number(match[1]);
      const name = cleanText(match[2]);
      const offerType = match[3] === "Free to Keep" ? "FREE TO KEEP" : "FREE WEEKEND";
      const expires = cleanText(match[4]).replace(/\s+/g, " ");
      if (id > 0 && name && !offers.some((offer) => offer.id === id)) {
        offers.push({ id, name, offerType, expires });
      }
    }

    const checked = await mapWithConcurrency(offers.slice(0, 20), 4, async (offer) => {
      const detailUrl = new URL("https://store.steampowered.com/api/appdetails");
      detailUrl.searchParams.set("appids", String(offer.id));
      detailUrl.searchParams.set("cc", cc);
      detailUrl.searchParams.set("l", "english");
      const details = await fetchJson(detailUrl);
      const envelope = details?.[offer.id];
      if (!envelope?.success || String(envelope.data?.type || "").toLowerCase() !== "game") return null;
      return {
        ...offer,
        name: envelope.data.name || offer.name,
        image: envelope.data.header_image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${offer.id}/header.jpg`,
        url: `https://store.steampowered.com/app/${offer.id}/`,
        releaseDate: envelope.data.release_date?.date || ""
      };
    });
    const items = checked.filter((entry) => entry.status === "fulfilled" && entry.value).map((entry) => entry.value);
    const result = { items, source: "SteamDB", sourceUrl: "https://steamdb.info/upcoming/free/" };
    res.json(saveCache(key, result));
  } catch (error) {
    console.error("Steam free promotions failed:", error);
    res.status(502).json({ error: "Current free Steam promotions are temporarily unavailable.", detail: error.message });
  }
});

app.get("/api/game/:appid", async (req, res) => {
  const appid = String(req.params.appid);
  if (!/^\d+$/.test(appid)) {
    return res.status(400).json({ error: "AppID must be numeric." });
  }

  const cc = String(req.query.cc || "US").slice(0, 2).toUpperCase();
  const key = `game:${appid}:${cc}`;
  const hit = cached(key);
  if (hit) return res.json(hit);

  try {
    const storeUrl = new URL("https://store.steampowered.com/api/appdetails");
    storeUrl.searchParams.set("appids", appid);
    storeUrl.searchParams.set("cc", cc);
    storeUrl.searchParams.set("l", "english");

    const usStoreUrl = new URL("https://store.steampowered.com/api/appdetails");
    usStoreUrl.searchParams.set("appids", appid);
    usStoreUrl.searchParams.set("cc", "US");
    usStoreUrl.searchParams.set("l", "english");

    const deckReportUrl = new URL("https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport");
    deckReportUrl.searchParams.set("nAppID", appid);
    deckReportUrl.searchParams.set("l", "english");

    const [storeResult, playersResult, usStoreResult, deckResult] = await Promise.allSettled([
      fetchJson(storeUrl),
      fetchJson(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`),
      cc === "US" ? Promise.resolve(null) : fetchJson(usStoreUrl),
      fetchJson(deckReportUrl)
    ]);

    const storeEnvelope = storeResult.status === "fulfilled"
      ? storeResult.value?.[appid]
      : null;

    if (storeResult.status === "rejected") {
      const reason = storeResult.reason;
      const status = reason?.status === 429 ? 503 : 502;
      console.warn(`Steam appdetails request failed for AppID ${appid} (region ${cc}): ${reason?.message || reason}`);
      return res.status(status).json({
        error: reason?.status === 429
          ? "Steam is rate-limiting requests. Please wait a little and try again."
          : "Steam appdetails is temporarily unavailable.",
        detail: reason?.message || "Unknown upstream error",
        ...(reason?.retryAfter ? { retry_after: reason.retryAfter } : {})
      });
    }

    if (!storeEnvelope?.success || !storeEnvelope.data) {
      console.warn(`Steam returned no appdetails data for AppID ${appid} (region ${cc}); success=${String(storeEnvelope?.success)}`);
      return res.status(404).json({
        error: "Steam did not return details for this AppID.",
        detail: "Steam returned success=false or an empty data field. The AppID may be invalid, unavailable in this region, or Steam may be temporarily having issues."
      });
    }

    const d = storeEnvelope.data;
    const usEnvelope = cc === "US" ? storeEnvelope : (usStoreResult.status === "fulfilled" ? usStoreResult.value?.[appid] : null);
    const usPriceOverview = usEnvelope?.success ? usEnvelope.data?.price_overview || null : null;
    const playerCount = playersResult.status === "fulfilled"
      ? playersResult.value?.response?.player_count ?? null
      : null;

    const deckData = deckResult.status === "fulfilled" && deckResult.value?.success === 1 ? deckResult.value.results : null;
    const deckCategory = Number(deckData?.resolved_category || 0);
    const deckStatusByCategory = {
      0: { status: "unknown", label: "Unknown", summary: "Steam has not published a compatibility rating for this game." },
      1: { status: "unsupported", label: "Unsupported", summary: "Steam reports that this game is not supported on Steam Deck." },
      2: { status: "playable", label: "Playable", summary: "The game works on Steam Deck, but may require some manual configuration." },
      3: { status: "verified", label: "Verified", summary: "The game meets Steam Deck compatibility requirements and should work out of the box." }
    };
    const deckCriteriaNames = {
      SteamDeckVerified_TestResult_DefaultControllerConfigFullyFunctional: "Controller configuration works by default",
      SteamDeckVerified_TestResult_ControllerGlyphsMatchDeckDevice: "Controller prompts match Steam Deck",
      SteamDeckVerified_TestResult_InterfaceTextIsLegible: "Interface text is readable",
      SteamDeckVerified_TestResult_DefaultConfigurationIsPerformant: "Default graphics settings perform well",
      SteamDeckVerified_TestResult_SupportsDisplayResolution: "Supports Steam Deck display resolution",
      SteamDeckVerified_TestResult_SupportsExternalControllers: "Supports external controllers",
      SteamDeckVerified_TestResult_NoLauncher: "No additional launcher required",
      SteamDeckVerified_TestResult_CloudSaves: "Cloud saves supported",
      SteamDeckVerified_TestResult_CompatibleWithSteamOS: "Compatible with SteamOS"
    };
    const deckCriteria = (deckData?.resolved_items || []).map((item) => {
      const token = String(item.loc_token || "").replace(/^#/, "");
      const key = token.replace(/^SteamDeckVerified_TestResult_/, "");
      const name = deckCriteriaNames[token] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      const result = Number(item.display_type) === 4 ? "pass" : Number(item.display_type) === 5 ? "fail" : "info";
      return { name, result };
    });
    const steamDeck = { ...(deckStatusByCategory[deckCategory] || deckStatusByCategory[0]), criteria: deckCriteria };

    let hero = d.header_image || "";
    const hero2x = hero.replace(/\/header\.jpg(?=\?|$)/, "/header_2x.jpg");
    if (hero2x !== hero) hero = hero2x;
    let libraryHero = "";
    let gameLogo = "";

    try {
      const assetUrl = new URL("https://api.steampowered.com/IStoreBrowseService/GetItems/v1/");
      assetUrl.searchParams.set("input_json", JSON.stringify({
        ids: [{ appid: Number(appid) }],
        context: { language: "english", country_code: cc },
        data_request: { include_assets: true }
      }));

      const assets = await fetchJson(assetUrl);
      const item = assets?.response?.store_items?.[0] || assets?.store_items?.[0];
      const itemAssets = item?.assets || {};
      const assetUrlFormat = String(itemAssets.asset_url_format || "");

      // Newer Steam titles use hash-based asset paths; the old AppID-only
      // URLs return 404 for many games. Prefer the exact URLs from StoreBrowse.
      const resolveAssetUrl = (assetPath, fallbackPath) => {
        if (!assetPath) return fallbackPath;
        if (assetUrlFormat.includes("${FILENAME}")) {
          // Steam may return either a complete URL template or a path template.
          // Avoid prefixing a complete URL with another store_item_assets path.
          const resolved = assetUrlFormat.replace("${FILENAME}", assetPath);
          if (/^https?:\/\//i.test(resolved)) return resolved;
          return `https://shared.akamai.steamstatic.com/store_item_assets/${resolved.replace(/^\/+/, "")}`;
        }
        return fallbackPath;
      };

      libraryHero = resolveAssetUrl(
        itemAssets.library_hero,
        `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`
      );

      const logoAsset = itemAssets.logo || itemAssets.logo_2x || itemAssets.library_logo || itemAssets.library_logo_2x;
      if (logoAsset) {
        gameLogo = resolveAssetUrl(
          logoAsset,
          `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}/logo.png`
        );
      } else {
        // StoreBrowse often omits logos for newer games. Ask SteamDB for the
        // hashed logo path before falling back to the legacy AppID-only URL.
        gameLogo = await fetchSteamDbLogo(appid)
          || (appid === "2483190"
            ? "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2483190/b494309a99c0631f1be4b211c2c80bcaaa13d06a/logo.png"
            : `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/logo.png`);
      }
    } catch {
      // This undocumented endpoint may not return data for every title.
    }

    const packageGroups = Array.isArray(d.package_groups) ? d.package_groups : [];
    const editions = packageGroups.flatMap((group) => (group.subs || []).map((sub) => ({
      name: cleanEditionName(sub.option_text || sub.name || group.title || group.name || "Steam edition"),
      description: sub.option_description || group.description || "",
      kind: group.name || group.title || "EDITION",
      priceValue: sub.price_in_cents_with_discount != null ? Number(sub.price_in_cents_with_discount) / 100 : (sub.price_in_cents != null ? Number(sub.price_in_cents) / 100 : null),
      price: sub.price_in_cents_with_discount != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: d.price_overview?.currency || "USD" }).format(Number(sub.price_in_cents_with_discount) / 100) : (sub.price_in_cents != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: d.price_overview?.currency || "USD" }).format(Number(sub.price_in_cents) / 100) : null),
      originalPrice: sub.price_in_cents != null && sub.price_in_cents_with_discount != null && Number(sub.price_in_cents) > Number(sub.price_in_cents_with_discount) ? new Intl.NumberFormat("en-US", { style: "currency", currency: d.price_overview?.currency || "USD" }).format(Number(sub.price_in_cents) / 100) : null,
      savings: sub.percent_savings_text ? String(sub.percent_savings_text).replace(/[^0-9]/g, "") : (sub.price_in_cents != null && sub.price_in_cents_with_discount != null && Number(sub.price_in_cents) > 0 ? String(Math.round((1 - Number(sub.price_in_cents_with_discount) / Number(sub.price_in_cents)) * 100)) : ""),
      url: (sub.packageid || sub.id) ? `https://store.steampowered.com/sub/${sub.packageid || sub.id}/` : ""
    })));

    const dlcIds = Array.isArray(d.dlc) ? d.dlc.map(Number).filter(Number.isFinite) : [];
    const dlcIdsToFetch = dlcIds.slice(0, 24);
    const dlcResults = await mapWithConcurrency(dlcIdsToFetch, 4, async (dlcId) => {
      const dlcUrl = new URL("https://store.steampowered.com/api/appdetails");
      dlcUrl.searchParams.set("appids", String(dlcId));
      dlcUrl.searchParams.set("cc", cc);
      dlcUrl.searchParams.set("l", "english");
      const response = await fetchJson(dlcUrl);
      const envelope = response?.[dlcId];
      if (!envelope?.success || !envelope.data) return null;
      const item = envelope.data;
      return { appid: dlcId, name: item.name || `DLC ${dlcId}`, image: item.header_image || "", price: item.price_overview?.final_formatted || (item.price_overview ? new Intl.NumberFormat("en-US", { style: "currency", currency: item.price_overview.currency || "USD" }).format(item.price_overview.final / 100) : (item.is_free ? "Free" : null)), url: `https://store.steampowered.com/app/${dlcId}/` };
    });
    const dlc = dlcResults.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
    const bundles = [];

    let parentGame = d.fullgame?.appid ? {
      appid: Number(d.fullgame.appid),
      name: d.fullgame.name || "Base game",
      header_image: d.fullgame.header_image || ""
    } : null;
    // Steam's DLC metadata often omits the parent game's artwork; request the base game's appdetails as a fallback.
    if (parentGame && !parentGame.header_image) {
      try {
        const parentUrl = new URL("https://store.steampowered.com/api/appdetails");
        parentUrl.searchParams.set("appids", String(parentGame.appid));
        parentUrl.searchParams.set("cc", cc);
        parentUrl.searchParams.set("l", "english");
        const parentEnvelope = (await fetchJson(parentUrl))?.[String(parentGame.appid)];
        if (parentEnvelope?.success && parentEnvelope.data) {
          parentGame = {
            ...parentGame,
            name: parentEnvelope.data.name || parentGame.name,
            header_image: parentEnvelope.data.header_image || parentEnvelope.data.header_image_2x || ""
          };
        }
      } catch (error) {
        console.warn(`Could not load base-game artwork for AppID ${parentGame.appid}: ${error.message || error}`);
      }
    }

    const result = {
      appid: Number(appid),
      name: d.name || "Unknown game",
      type: d.type || "game",
      parent_game: parentGame,
      short_description: d.short_description || "",
      about_the_game: d.about_the_game || "",
      header_image: d.header_image || "",
      header_image_2x: hero,
      library_hero: libraryHero,
      game_logo: gameLogo,
      background: d.background || "",
      developers: d.developers || [],
      publishers: d.publishers || [],
      release_date: d.release_date?.date || "Unknown",
      coming_soon: Boolean(d.release_date?.coming_soon),
      genres: (d.genres || []).map((g) => g.description),
      categories: (d.categories || []).map((c) => c.description),
      platforms: d.platforms || {},
      price_overview: d.price_overview || null,
      us_price_overview: usPriceOverview,
      editions,
      bundles,
      dlc,
      dlc_total: dlcIds.length,
      metacritic: d.metacritic || null,
      recommendations: d.recommendations?.total ?? null,
      screenshots: (d.screenshots || []).map((s) => s.path_full).filter(Boolean),
      movies: (d.movies || []).map((m) => ({
        name: m.name,
        thumbnail: m.thumbnail,
        webm: m.webm?.max || m.webm?.["480"] || "",
        mp4: m.mp4?.max || m.mp4?.["480"] || ""
      })),
      website: d.website || "",
      steam_url: `https://store.steampowered.com/app/${appid}/`,
      player_count: playerCount,
      steam_deck: steamDeck,
      pc_requirements: d.pc_requirements || null
    };

    res.json(saveCache(key, result));
  } catch (error) {
    console.error(`Failed to load Steam AppID ${appid}:`, error);
    res.status(502).json({
      error: "Could not load game details from Steam.",
      detail: error.message
    });
  }
});

app.get("/api/game/:appid/bundles", async (req, res) => {
  const appid = String(req.params.appid);
  if (!/^\\d+$/.test(appid)) return res.status(400).json({ error: "AppID must be numeric." });
  const cc = String(req.query.cc || "US").slice(0, 2).toUpperCase();
  const key = `bundles:${appid}:${cc}`;
  const hit = cached(key);
  if (hit) return res.json(hit);
  const bundles = await fetchSteamBundles(appid, cc);
  return res.json(saveCache(key, { bundles }));
});

app.get("/api/game/:appid/dlc", async (req, res) => {
  const appid = String(req.params.appid);
  if (!/^\d+$/.test(appid)) return res.status(400).json({ error: "AppID must be numeric." });

  const cc = String(req.query.cc || "US").slice(0, 2).toUpperCase();
  const offset = Math.max(0, Number.parseInt(req.query.offset || "0", 10) || 0);
  const limit = Math.min(24, Math.max(1, Number.parseInt(req.query.limit || "24", 10) || 24));

  try {
    const parentUrl = new URL("https://store.steampowered.com/api/appdetails");
    parentUrl.searchParams.set("appids", appid);
    parentUrl.searchParams.set("cc", cc);
    parentUrl.searchParams.set("l", "english");
    const parentResponse = await fetchJson(parentUrl);
    const parent = parentResponse?.[appid];
    if (!parent?.success || !parent.data) return res.status(404).json({ error: "Steam did not return details for this game." });

    const allIds = Array.isArray(parent.data.dlc) ? [...new Set(parent.data.dlc.map(Number).filter(Number.isFinite))] : [];
    const ids = allIds.slice(offset, offset + limit);
    const results = await mapWithConcurrency(ids, 4, async (dlcId) => {
      const url = new URL("https://store.steampowered.com/api/appdetails");
      url.searchParams.set("appids", String(dlcId));
      url.searchParams.set("cc", cc);
      url.searchParams.set("l", "english");
      const response = await fetchJson(url);
      const envelope = response?.[dlcId];
      if (!envelope?.success || !envelope.data) return null;
      const item = envelope.data;
      return {
        appid: dlcId,
        name: item.name || `DLC ${dlcId}`,
        image: item.header_image || "",
        price: item.price_overview?.final_formatted || (item.price_overview ? new Intl.NumberFormat("en-US", { style: "currency", currency: item.price_overview.currency || "USD" }).format(item.price_overview.final / 100) : (item.is_free ? "Free" : null)),
        url: `https://store.steampowered.com/app/${dlcId}/`
      };
    });
    const items = results.filter((item) => item.status === "fulfilled" && item.value).map((item) => item.value);
    res.json({ items, total: allIds.length, nextOffset: offset + ids.length, hasMore: offset + ids.length < allIds.length });
  } catch (error) {
    console.error(`Failed to load more DLC for AppID ${appid}:`, error);
    res.status(502).json({ error: "Could not load more DLC from Steam.", detail: error.message });
  }
});



function resolveSteamProfileId(profile, apiKey) {
  const value = String(profile || "").trim();
  const numeric = value.match(/^\d{17}$/);
  const profileUrl = value.match(/steamcommunity\.com\/profiles\/(\d{17})(?:\/|$|\?)/i);
  const vanity = value.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (numeric) return Promise.resolve(numeric[0]);
  if (profileUrl) return Promise.resolve(profileUrl[1]);
  if (!vanity) return Promise.reject(new Error("Use a Steam profile URL (/profiles/… or /id/…) or a 17-digit SteamID64."));
  const url = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("vanityurl", decodeURIComponent(vanity[1]));
  return fetchJson(url).then((data) => {
    if (Number(data?.response?.success) !== 1 || !data?.response?.steamid) throw new Error("Could not resolve that Steam vanity profile.");
    return String(data.response.steamid);
  });
}

app.get("/api/steam-profile", async (req, res) => {
  const apiKey = String(req.get("X-Steam-API-Key") || process.env.STEAM_API_KEY || "").trim();
  if (!apiKey) return res.status(503).json({ error: "Steam profile data needs STEAM_API_KEY configured on the server." });
  try {
    const steamId = await resolveSteamProfileId(req.query.profile, apiKey);
    const summariesUrl = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    summariesUrl.searchParams.set("key", apiKey);
    summariesUrl.searchParams.set("steamids", steamId);
    const [summaryResult, gamesResult, levelResult, badgesResult, favoriteBadgeResult, friendsResult, recentResult, backgroundResult, customizationResult, equippedItemsResult, animatedAvatarResult, avatarFrameResult] = await Promise.allSettled([
      fetchJson(summariesUrl),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId) + "&include_appinfo=true&include_played_free_games=true")),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId))),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetBadges/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId))),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetFavoriteBadge/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId))),
      fetchJson(new URL("https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId) + "&relationship=friend")),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId) + "&count=0")),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetProfileBackground/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId))),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetProfileCustomization/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId))),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetProfileItemsEquipped/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId))),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetAnimatedAvatar/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId))),
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetAvatarFrame/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId)))
    ]);
    const player = summaryResult.status === "fulfilled" ? summaryResult.value?.response?.players?.[0] : null;
    const backgroundData = backgroundResult.status === "fulfilled" ? backgroundResult.value?.response?.profile_background : null;
    const customization = customizationResult.status === "fulfilled" ? customizationResult.value?.response?.profile_customization : null;
    const equippedResponse = equippedItemsResult.status === "fulfilled" ? equippedItemsResult.value?.response : null;
    const equippedItems = equippedResponse?.profile_items || equippedResponse || {};
    const animatedAvatarData = animatedAvatarResult.status === "fulfilled" ? (animatedAvatarResult.value?.response?.avatar || animatedAvatarResult.value?.response?.animated_avatar) : null;
    const avatarFrameData = avatarFrameResult.status === "fulfilled" ? avatarFrameResult.value?.response?.avatar_frame : null;
    const normalizeSteamAssetUrl = (value) => {
      if (typeof value !== "string" || !value.trim()) return "";
      const asset = value.trim();
      if (/^https?:\/\//i.test(asset)) return asset;
      if (asset.startsWith("//")) return "https:" + asset;
      return "https://shared.fastly.steamstatic.com/community_assets/images/" + asset.replace(/^\/+/, "");
    };
    const avatarAnimated = normalizeSteamAssetUrl(
      animatedAvatarData?.image_small ||
      equippedItems?.animated_avatar?.image_small ||
      equippedItems?.animated_avatar?.image_large ||
      ""
    );
    const avatarFrame = normalizeSteamAssetUrl(
      equippedItems?.avatar_frame?.image_small ||
      equippedItems?.avatar_frame?.image_large ||
      avatarFrameData?.image_small ||
      avatarFrameData?.image_large ||
      ""
    );
    const backgroundImageRaw = backgroundData?.image_large || backgroundData?.image || backgroundData?.image_small || "";
    const backgroundImage = normalizeSteamAssetUrl(backgroundImageRaw);
    const backgroundVideoRaw = backgroundData?.movie_webm || backgroundData?.video_webm || backgroundData?.movie || "";
    const backgroundVideo = normalizeSteamAssetUrl(backgroundVideoRaw);
    if (!player) return res.status(404).json({ error: "Steam profile not found, or Steam did not return a public profile summary." });
    const games = gamesResult.status === "fulfilled" && Array.isArray(gamesResult.value?.response?.games) ? gamesResult.value.response.games : null;
    const recent = recentResult.status === "fulfilled" ? (recentResult.value?.response?.games || []) : [];
    const badges = badgesResult.status === "fulfilled" ? badgesResult.value?.response : null;
    const visibility = Number(player.communityvisibilitystate);
    const hours = games ? Math.round(games.reduce((sum, item) => sum + Number(item.playtime_forever || 0), 0) / 60) : null;
    const countryNames = { US: "United States", GB: "United Kingdom", DE: "Germany", UA: "Ukraine", TR: "Türkiye", CA: "Canada", AU: "Australia", FR: "France", PL: "Poland", BR: "Brazil", IN: "India", JP: "Japan" };
    const profile = {
      steamId: String(player.steamid),
      name: player.personaname || "Steam user",
      avatar: player.avatarfull || player.avatarmedium || player.avatar || "",
      avatarAnimated: avatarAnimated || "",
      avatarFrame: avatarFrame || "",
      url: player.profileurl || ("https://steamcommunity.com/profiles/" + steamId + "/"),
      realName: player.realname || "",
      country: player.loccountrycode ? (countryNames[player.loccountrycode] || player.loccountrycode) : "",
      summary: "",
      online: Number(player.personastate || 0) !== 0,
      status: ({ 0: "Offline", 1: "Online", 2: "Busy", 3: "Away", 4: "Snooze", 5: "Looking to trade", 6: "Looking to play" })[Number(player.personastate || 0)] || "Online",
      currentGame: player.gameextrainfo ? {
        name: String(player.gameextrainfo),
        appid: /^\d+$/.test(String(player.gameid || "")) ? Number(player.gameid) : null
      } : null,
      created: player.timecreated ? new Date(Number(player.timecreated) * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "",
      lastLogoff: player.lastlogoff ? new Date(Number(player.lastlogoff) * 1000).toLocaleString("en-US") : "",
      visibility: visibility === 3 ? "Public" : visibility === 2 ? "Friends only" : visibility === 1 ? "Private" : "Unknown"
    };
    const friends = friendsResult.status === "fulfilled" && Array.isArray(friendsResult.value?.friendslist?.friends) ? friendsResult.value.friendslist.friends.length : null;
    const badgeList = badges && Array.isArray(badges.badges) ? badges.badges : [];
    const totalBadges = badges ? badgeList.length : null;
    const yearOfService = badgeList.find((badge) => Number(badge.badgeid) === 1) || null;
    const favoriteBadgeResponse = favoriteBadgeResult.status === "fulfilled" ? favoriteBadgeResult.value?.response : null;
    const favoriteBadgeId = Number(favoriteBadgeResponse?.badgeid);
    const favoriteBadgeAppId = Number(favoriteBadgeResponse?.appid) || 0;
    const favoriteBadgeLevel = Number(favoriteBadgeResponse?.level) || 1;
    const favoriteBadge = favoriteBadgeId > 0 ? {
      badgeId: favoriteBadgeId,
      appId: favoriteBadgeAppId,
      level: favoriteBadgeLevel,
      name: favoriteBadgeId === 1 ? "Years of Service" : favoriteBadgeAppId ? "Game Badge" : "Steam Badge",
      image: favoriteBadgeId === 1 ? "https://community.fastly.steamstatic.com/public/images/badges/02_years/steamyears" + favoriteBadgeLevel + "_80.png" : ""
    } : null;
    res.json({
      profile: { ...profile, background: backgroundImage, backgroundVideo, theme: customization?.profile_theme || "" },
      profileCustomization: customization ? { theme: customization.profile_theme || "", showcaseCount: Array.isArray(customization.slots) ? customization.slots.length : 0 } : null,
      favoriteBadge,
      yearOfService: yearOfService ? { level: Number(yearOfService.level) || 1, image: "https://community.fastly.steamstatic.com/public/images/badges/02_years/steamyears" + (Number(yearOfService.level) || 1) + "_80.png", xp: Number(yearOfService.xp) || 0 } : null,
      stats: {
        games: games ? games.length : null,
        hours: hours,
        level: levelResult.status === "fulfilled" && Number.isFinite(Number(levelResult.value?.response?.player_level)) ? Number(levelResult.value.response.player_level) : null,
        badges: totalBadges,
        friends: friends
      },
      recentGames: (await mapWithConcurrency(recent.slice(0, 10), 4, async (item) => {
        const appid = Number(item.appid);
        return {
          appid,
          name: item.name || ("App " + item.appid),
          image: await fetchSteamHeaderImage(appid),
          hours: Math.round(Number(item.playtime_forever || 0) / 60),
          hours2Weeks: Math.round(Number(item.playtime_2weeks || 0) / 60)
        };
      })).filter((entry) => entry.status === "fulfilled").map((entry) => entry.value)
    });
  } catch (error) {
    console.error("Steam profile fetch failed:", error);
    res.status(error?.status === 429 ? 503 : 502).json({ error: error.message || "Could not load Steam profile data." });
  }
});


app.post("/api/ownership-check", async (req, res) => {
  const apiKey = String(req.get("X-Steam-API-Key") || process.env.STEAM_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(503).json({ error: "Add your Steam Web API key in Settings to check your library." });
  }

  const profile = String(req.body?.profile || "").trim();
  const appids = [...new Set((Array.isArray(req.body?.appids) ? req.body.appids : [])
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0))].slice(0, 100);
  if (!profile) return res.status(400).json({ error: "Enter a Steam profile URL or SteamID64." });
  if (!appids.length) return res.status(400).json({ error: "No valid game or DLC AppIDs were supplied." });

  try {
    let steamId = "";
    const profileUrlMatch = profile.match(/steamcommunity\.com\/profiles\/(\d{17})(?:\/|$|\?)/i);
    const numericMatch = profile.match(/^\d{17}$/);
    const vanityMatch = profile.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
    if (numericMatch) steamId = numericMatch[0];
    else if (profileUrlMatch) steamId = profileUrlMatch[1];
    else if (vanityMatch) {
      const vanityUrl = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
      vanityUrl.searchParams.set("key", apiKey);
      vanityUrl.searchParams.set("vanityurl", decodeURIComponent(vanityMatch[1]));
      const vanityData = await fetchJson(vanityUrl);
      if (Number(vanityData?.response?.success) !== 1 || !vanityData?.response?.steamid) {
        return res.status(400).json({ error: "Could not resolve that Steam vanity profile. Check the URL and try a /profiles/ SteamID64 link instead." });
      }
      steamId = String(vanityData.response.steamid);
    } else {
      return res.status(400).json({ error: "Use a Steam profile URL (/profiles/… or /id/…) or a 17-digit SteamID64." });
    }

    const ownedUrl = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
    ownedUrl.searchParams.set("key", apiKey);
    ownedUrl.searchParams.set("steamid", steamId);
    ownedUrl.searchParams.set("include_appinfo", "true");
    ownedUrl.searchParams.set("include_played_free_games", "true");
    const libraryData = await fetchJson(ownedUrl);
    const response = libraryData?.response;
    if (!response || !Array.isArray(response.games)) {
      return res.status(403).json({ error: "Steam did not return an owned-games list. Make sure your profile's Game details privacy is set to Public." });
    }

    const ownedApps = new Map(response.games.map((item) => [Number(item.appid), item]));
    const details = await mapWithConcurrency(appids, 5, async (id) => {
      const url = new URL("https://store.steampowered.com/api/appdetails");
      url.searchParams.set("appids", String(id));
      url.searchParams.set("l", "english");
      const data = await fetchJson(url);
      return { appid: id, name: data?.[id]?.data?.name || ("App " + id), owned: ownedApps.has(id) };
    });
    const items = details.filter((item) => item.status === "fulfilled" && item.value).map((item) => item.value);
    res.json({ steamId, totalOwnedGames: Number(response.game_count || response.games.length), items });
  } catch (error) {
    console.error("Steam ownership check failed:", error);
    const status = error?.status === 429 ? 503 : 502;
    res.status(status).json({
      error: error?.status === 401 || error?.status === 403
        ? "Steam rejected the library request. Check the API key and make sure Game details are public."
        : "Could not check this Steam library right now.",
      detail: error.message
    });
  }
});

const TF2_MARKET_REGIONS = [
  { code: "US", label: "United States", flag: "🇺🇸", country: "US", currency: 1, currencyCode: "USD" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧", country: "GB", currency: 2, currencyCode: "GBP" },
  { code: "EU", label: "Euro area", flag: "🇪🇺", country: "DE", currency: 3, currencyCode: "EUR" },
  { code: "AR", label: "Argentina", flag: "🇦🇷", country: "AR", currency: 1, currencyCode: "USD" },
  { code: "TR", label: "Türkiye", flag: "🇹🇷", country: "TR", currency: 1, currencyCode: "USD" },
  { code: "UA", label: "Ukraine", flag: "🇺🇦", country: "UA", currency: 18, currencyCode: "UAH" },
  { code: "RU", label: "Russia", flag: "🇷🇺", country: "RU", currency: 5, currencyCode: "RUB" },
  { code: "IN", label: "India", flag: "🇮🇳", country: "IN", currency: 24, currencyCode: "INR" },
  { code: "BR", label: "Brazil", flag: "🇧🇷", country: "BR", currency: 7, currencyCode: "BRL" },
  { code: "KZ", label: "Kazakhstan", flag: "🇰🇿", country: "KZ", currency: 37, currencyCode: "KZT" },
  { code: "CN", label: "China", flag: "🇨🇳", country: "CN", currency: 23, currencyCode: "CNY" },
  { code: "JP", label: "Japan", flag: "🇯🇵", country: "JP", currency: 8, currencyCode: "JPY" }
];

app.get("/api/market-regions", async (_req, res) => {
  try {
    // This project intentionally uses item_nameid=1 for the TF2 key, as in the previously working setup.
    const itemNameId = "1";
    const results = await mapWithConcurrency(TF2_MARKET_REGIONS, 2, async (region) => {
      const url = new URL("https://steamcommunity.com/market/itemordershistogram");
      // Country is ISO alpha-2 (e.g. US); currency is Steam’s numeric wallet currency ID (e.g. 1 for USD).
      url.searchParams.set("country", region.country);
      url.searchParams.set("language", "english");
      url.searchParams.set("currency", String(region.currency));
      url.searchParams.set("item_nameid", itemNameId);
      url.searchParams.set("two_factor", "0");
      url.searchParams.set("norender", "1");

      const listingUrl = "https://steamcommunity.com/market/listings/440/Mann-Co.-Supply-Crate-Key/";
      const data = await fetchJson(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Referer": listingUrl,
          "Origin": "https://steamcommunity.com"
        }
      });

      if (Number(data?.success) !== 1) {
        throw new Error(`Steam histogram returned success=${String(data?.success ?? "missing")} for ${region.code} (country=${region.country}, currency=${region.currency})`);
      }

      const lowest = Number(data.lowest_sell_order);
      const highestBuy = Number(data.highest_buy_order);
      const graphLowest = Array.isArray(data.sell_order_graph) && data.sell_order_graph.length
        ? Number(data.sell_order_graph[0][0]) : NaN;
      const graphHighestBuy = Array.isArray(data.buy_order_graph) && data.buy_order_graph.length
        ? Number(data.buy_order_graph[0][0]) : NaN;
      const price = Number.isFinite(lowest) && lowest > 0 ? lowest / 100 : (Number.isFinite(graphLowest) && graphLowest > 0 ? graphLowest : null);
      const buyPrice = Number.isFinite(highestBuy) && highestBuy > 0 ? highestBuy / 100 : (Number.isFinite(graphHighestBuy) && graphHighestBuy > 0 ? graphHighestBuy : null);
      const net = price == null ? null : price * 0.87;
      const previous = previousRegionalSellPrices.get(region.code);
      const change = price == null || previous == null ? null : price - previous;
      if (price != null) previousRegionalSellPrices.set(region.code, price);

      const prefix = String(data.price_prefix || "");
      const suffix = String(data.price_suffix || "");
      const fmt = (value) => value == null ? null : `${prefix}${new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value)}${suffix}`;

      return {
        ...region,
        lowestSell: price,
        lowestSellFormatted: fmt(price),
        net: net == null ? null : Number(net.toFixed(2)),
        netFormatted: fmt(net == null ? null : Number(net.toFixed(2))),
        change: change == null ? null : Number(change.toFixed(2)),
        changeFormatted: change == null ? null : fmt(Math.abs(change)),
        highestBuy: buyPrice,
        sellOrderCount: data.sell_order_count ?? null,
        buyOrderCount: data.buy_order_count ?? null
      };
    });

    const regions = results.filter((item) => item.status === "fulfilled").map((item) => item.value);
    const failures = results
      .map((item, index) => item.status === "rejected"
        ? { region: TF2_MARKET_REGIONS[index]?.code, reason: item.reason?.message || "Unknown Steam error" }
        : null)
      .filter(Boolean);

    if (!regions.length) {
      console.error("Steam histogram failed for all regions:", failures);
      throw new Error("Steam returned no valid histogram data. " + failures.map((item) => `${item.region}: ${item.reason}`).join("; "));
    }

    res.set("Cache-Control", "no-store");
    res.json({
      item: "Mann Co. Supply Crate Key",
      itemNameId,
      source: "Steam Community Market itemordershistogram",
      fetchedAt: new Date().toISOString(),
      regions,
      failedRegions: failures
    });
  } catch (error) {
    console.error("Steam regional market request failed:", error);
    res.status(502).json({
      error: "Could not load TF2 Key prices from Steam Community Market.",
      detail: error.message
    });
  }
});

const TF2_KEY_PRICE_CURRENCIES = {
  US: 1,  // USD
  GB: 2,  // GBP
  DE: 3,  // EUR
  TR: 1,  // USD (Steam pricing used by this calculator)
  AR: 1,  // USD (Steam pricing used by this calculator)
  PL: 6,  // PLN
  UA: 18, // UAH
  IN: 24, // INR
  BR: 7   // BRL
};

app.get("/api/key-price", async (req, res) => {
  const region = String(req.query.region || "US").toUpperCase();
  const currency = TF2_KEY_PRICE_CURRENCIES[region];
  if (!currency) return res.status(400).json({ error: "Unsupported Steam region." });

  try {
    const url = new URL("https://steamcommunity.com/market/priceoverview/");
    url.searchParams.set("appid", "440");
    url.searchParams.set("currency", String(currency));
    url.searchParams.set("market_hash_name", "Mann Co. Supply Crate Key");

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 SteamPulseWeb/1.0",
        "Referer": "https://steamcommunity.com/market/"
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return res.status(502).json({ error: `Steam price API returned ${response.status} for ${region}.` });

    const data = await response.json();
    const rawPrice = String(data?.lowest_price || "");
    const grossPrice = Number(rawPrice.replace(/[^0-9.,]/g, "").replace(/,(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
    if (!data?.success || !Number.isFinite(grossPrice) || grossPrice <= 0) {
      return res.status(502).json({ error: `Steam did not return a valid key price for ${region}.` });
    }

    // Steam Market's seller fee is approximately 13%; use the net proceeds.
    const netPrice = Number((grossPrice * 0.87).toFixed(2));
    res.set("Cache-Control", "no-store");
    res.json({
      region,
      currency,
      lowestPrice: rawPrice,
      grossPrice,
      feeRate: 0.13,
      netPrice,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Steam key price request failed for ${region}:`, error);
    res.status(502).json({ error: `Could not load Steam key price for ${region}.`, detail: error.message });
  }
});

app.get("/api/shop-data", async (_req, res) => {
  try {
    const response = await fetch("https://api.codemage.ir/Projects/SteamPulse/ShopData/", {
      headers: { "Accept": "application/json", "User-Agent": "SteamPulseWeb/1.0" },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return res.status(502).json({ error: `Shop data API returned ${response.status}.` });
    const data = await response.json();
    if (!data || !Number.isFinite(Number(data.Key)) || !Number.isFinite(Number(data.KeyBuy))) {
      return res.status(502).json({ error: "Shop data API returned invalid key price data." });
    }

    // Fetch the live USD price for Mann Co. Supply Crate Key from Steam Community Market.
    let steamKeyPriceUsd = null;
    let steamKeyPriceUpdatedAt = null;
    try {
      const steamPriceResponse = await fetch(
        "https://steamcommunity.com/market/priceoverview/?appid=440&currency=1&market_hash_name=Mann%20Co.%20Supply%20Crate%20Key",
        {
          headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 SteamPulseWeb/1.0" },
          signal: AbortSignal.timeout(10000)
        }
      );
      if (steamPriceResponse.ok) {
        const steamPrice = await steamPriceResponse.json();
        const parsedPrice = Number(String(steamPrice?.lowest_price || "").replace(/[^0-9.]/g, ""));
        if (steamPrice?.success && Number.isFinite(parsedPrice) && parsedPrice > 0) {
          steamKeyPriceUsd = parsedPrice;
          steamKeyPriceUpdatedAt = new Date().toISOString();
        }
      }
    } catch (steamPriceError) {
      console.error("Steam key price overview request failed:", steamPriceError.message);
    }

    res.set("Cache-Control", "no-store");
    res.json({
      ...data,
      steamKeyPriceUsd,
      steamKeyPriceUpdatedAt
    });
  } catch (error) {
    console.error("Shop data request failed:", error);
    res.status(502).json({ error: "Could not fetch live shop data.", detail: error.message });
  }
});


app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`SteamPulse API listening on http://localhost:${PORT}`);
});
