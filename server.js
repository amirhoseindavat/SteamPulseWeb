import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
app.use(cors());
app.use(express.json());

const cache = new Map();
const inflightRequests = new Map();
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
        if (assetPath && assetUrlFormat.includes("${FILENAME}")) {
          return `https://shared.steamstatic.com/store_item_assets/${assetUrlFormat.replace("${FILENAME}", assetPath)}`;
        }
        return fallbackPath;
      };

      libraryHero = resolveAssetUrl(
        itemAssets.library_hero,
        `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`
      );

      const logoAsset = itemAssets.logo || itemAssets.library_logo;
      gameLogo = resolveAssetUrl(
        logoAsset,
        `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}/logo.png`
      );
    } catch {
      // This undocumented endpoint may not return data for every title.
    }

    const packageGroups = Array.isArray(d.package_groups) ? d.package_groups : [];
    const editions = packageGroups.flatMap((group) => (group.subs || []).map((sub) => ({
      name: sub.option_text || sub.name || group.title || group.name || "Steam edition",
      description: sub.option_description || group.description || "",
      kind: group.name || group.title || "EDITION",
      priceValue: sub.price_in_cents_with_discount != null ? Number(sub.price_in_cents_with_discount) / 100 : (sub.price_in_cents != null ? Number(sub.price_in_cents) / 100 : null),
      price: sub.price_in_cents_with_discount != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: d.price_overview?.currency || "USD" }).format(Number(sub.price_in_cents_with_discount) / 100) : (sub.price_in_cents != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: d.price_overview?.currency || "USD" }).format(Number(sub.price_in_cents) / 100) : null),
      savings: sub.percent_savings_text ? String(sub.percent_savings_text).replace(/[^0-9]/g, "") : "",
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

    const result = {
      appid: Number(appid),
      name: d.name || "Unknown game",
      type: d.type || "game",
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`SteamPulse API listening on http://localhost:${PORT}`);
});
