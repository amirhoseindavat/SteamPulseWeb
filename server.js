import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
app.use(cors());
app.use(express.json());

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "SteamPulseWeb/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Steam request failed (${response.status})`);
  }
  return response.json();
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

    if (!storeEnvelope?.success || !storeEnvelope.data) {
      const reason = storeResult.status === "rejected" ? storeResult.reason?.message : null;
      return res.status(404).json({
        error: "Steam did not return details for this AppID.",
        ...(reason ? { detail: reason } : {})
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

    try {
      const assetUrl = new URL("https://api.steampowered.com/IStoreBrowseService/GetItems/v1/");
      assetUrl.searchParams.set("input_json", JSON.stringify({
        ids: [{ appid: Number(appid) }],
        context: { language: "english", country_code: cc }
      }));

      const assets = await fetchJson(assetUrl);
      const item = assets?.response?.store_items?.[0] || assets?.store_items?.[0];
      const hash = item?.assets?.library_hero;
      if (hash) {
        libraryHero = `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero_2x.jpg`;
      }
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
    const dlcResults = await Promise.allSettled(dlcIdsToFetch.map(async (dlcId) => {
      const dlcUrl = new URL("https://store.steampowered.com/api/appdetails");
      dlcUrl.searchParams.set("appids", String(dlcId));
      dlcUrl.searchParams.set("cc", cc);
      dlcUrl.searchParams.set("l", "english");
      const response = await fetchJson(dlcUrl);
      const envelope = response?.[dlcId];
      if (!envelope?.success || !envelope.data) return null;
      const item = envelope.data;
      return { appid: dlcId, name: item.name || `DLC ${dlcId}`, image: (item.header_image || "").replace(/\/header\.jpg(?=\?|$)/, "/header_2x.jpg"), price: item.price_overview?.final_formatted || (item.price_overview ? new Intl.NumberFormat("en-US", { style: "currency", currency: item.price_overview.currency || "USD" }).format(item.price_overview.final / 100) : (item.is_free ? "Free" : null)), url: `https://store.steampowered.com/app/${dlcId}/` };
    }));
    const dlc = dlcResults.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);

    const result = {
      appid: Number(appid),
      name: d.name || "Unknown game",
      type: d.type || "game",
      short_description: d.short_description || "",
      about_the_game: d.about_the_game || "",
      header_image: hero,
      library_hero: libraryHero,
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`SteamPulse API listening on http://localhost:${PORT}`);
});
