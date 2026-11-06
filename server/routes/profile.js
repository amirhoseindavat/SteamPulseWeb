export function registerProfileRoutes(app, { fetchJson, fetchSteamHeaderImage, mapWithConcurrency }) {
function resolveSteamProfileId(profile, apiKey) {
  const value = String(profile || "").trim();
  const numeric = value.match(/^\d{17}$/);
  const profileUrl = value.match(/steamcommunity\.com\/profiles\/(\d{17})(?:\/|$|\?)/i);
  const vanity = value.match(/steamcommunity\.com\/id\/([^/?#]+)/i) || ( /^[a-zA-Z0-9_-]{2,32}$/.test(value) ? [value, value] : null);
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
    const [summaryResult, gamesResult, levelResult, badgesResult, favoriteBadgeResult, friendsResult, recentResult, backgroundResult, customizationResult, equippedItemsResult, animatedAvatarResult, avatarFrameResult, bansResult] = await Promise.allSettled([
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
      fetchJson(new URL("https://api.steampowered.com/IPlayerService/GetAvatarFrame/v1/?key=" + encodeURIComponent(apiKey) + "&steamid=" + encodeURIComponent(steamId))),
      fetchJson(new URL("https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=" + encodeURIComponent(apiKey) + "&steamids=" + encodeURIComponent(steamId)))
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
    const currentGameAppId = /^\d+$/.test(String(player.gameid || "")) ? Number(player.gameid) : null;
    const currentGameImage = currentGameAppId ? await fetchSteamHeaderImage(currentGameAppId) : "";
    const profile = {
      steamId: String(player.steamid),
      name: player.personaname || "Steam user",
      avatar: player.avatarfull || player.avatarmedium || player.avatar || "",
      avatarAnimated: avatarAnimated || "",
      avatarFrame: avatarFrame || "",
      url: player.profileurl || ("https://steamcommunity.com/profiles/" + steamId + "/"),
      realName: player.realname || "",
      country: player.loccountrycode ? (countryNames[player.loccountrycode] || player.loccountrycode) : "",
      countryCode: String(player.loccountrycode || "").toUpperCase(),
      summary: "",
      online: Number(player.personastate || 0) !== 0,
      status: ({ 0: "Offline", 1: "Online", 2: "Busy", 3: "Away", 4: "Snooze", 5: "Looking to trade", 6: "Looking to play" })[Number(player.personastate || 0)] || "Online",
      currentGame: player.gameextrainfo ? {
        name: String(player.gameextrainfo),
        appid: currentGameAppId,
        image: currentGameImage
      } : null,
      created: player.timecreated ? new Date(Number(player.timecreated) * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "",
      lastLogoff: player.lastlogoff ? new Date(Number(player.lastlogoff) * 1000).toLocaleString("en-US") : "",
      visibility: visibility === 3 ? "Public" : visibility === 2 ? "Friends only" : visibility === 1 ? "Private" : "Unknown"
    };
    const banPlayer = bansResult.status === "fulfilled" ? bansResult.value?.players?.[0] : null;
    const bans = banPlayer ? {
      available: true,
      communityBanned: Boolean(banPlayer.CommunityBanned),
      vacBanned: Boolean(banPlayer.VACBanned),
      numberOfVACBans: Number(banPlayer.NumberOfVACBans) || 0,
      daysSinceLastBan: Number(banPlayer.DaysSinceLastBan) || 0,
      numberOfGameBans: Number(banPlayer.NumberOfGameBans) || 0,
      economyBan: String(banPlayer.EconomyBan || "none").toLowerCase()
    } : { available: false, error: bansResult.status === "rejected" ? (bansResult.reason?.message || "Steam ban data is unavailable.") : "Steam did not return ban data." };
    const friends = friendsResult.status === "fulfilled" && Array.isArray(friendsResult.value?.friendslist?.friends) ? friendsResult.value.friendslist.friends.length : null;
    const badgeList = badges && Array.isArray(badges.badges) ? badges.badges : [];
    const totalBadges = badges ? badgeList.length : null;
    const yearOfService = badgeList.find((badge) => Number(badge.badgeid) === 1) || null;
    const gameCollector = badgeList.find((badge) => Number(badge.badgeid) === 13) || null;
    let gameCollectorImage = "";
    let gameCollectorGamesCount = null;
    if (gameCollector) {
      try {
        const badgePage = await fetch("https://steamcommunity.com/profiles/" + encodeURIComponent(steamId) + "/badges/13/?l=english", {
          headers: { "User-Agent": "Mozilla/5.0 SteamPulseWeb/1.0", "Accept": "text/html,application/xhtml+xml" },
          signal: AbortSignal.timeout(7000)
        });
        if (badgePage.ok) {
          const badgeHtml = await badgePage.text();
          const imageMatch = badgeHtml.match(/(?:src|data-src)=["']([^"']*\/13_gamecollector\/[^"']+_80\.png(?:\?[^"']*)?)["']/i);
          if (imageMatch) gameCollectorImage = imageMatch[1].startsWith("//") ? "https:" + imageMatch[1] : imageMatch[1];
        }
      } catch (badgeImageError) {
        console.warn("Could not load Game Collector badge artwork:", badgeImageError.message || badgeImageError);
      }
      if (!gameCollectorImage) gameCollectorImage = "https://community.fastly.steamstatic.com/public/images/badges/13_gamecollector/40000_80.png";

      // Get the count from the actual Game Collector showcase on the public
      // profile. GetOwnedGames also includes played free games and other
      // licenses that Steam does not count toward this showcase.
      try {
        const profilePage = await fetch("https://steamcommunity.com/profiles/" + encodeURIComponent(steamId) + "/?l=english", {
          headers: { "User-Agent": "Mozilla/5.0 SteamPulseWeb/1.0", "Accept": "text/html,application/xhtml+xml" },
          signal: AbortSignal.timeout(7000)
        });
        if (profilePage.ok) {
          const profileHtml = await profilePage.text();
          const plainText = profileHtml
            .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
            .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;|&#160;/gi, " ")
            .replace(/&#44;|&comma;/gi, ",")
            .replace(/&amp;/gi, "&")
            .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
            .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
            .replace(/\s+/g, " ");

          // Steam's current profile header exposes the library total in the
          // Games navigation link (profile_count_link_total). Read that exact
          // element rather than relying on the optional "Games Owned" showcase.
          const gamesLink = profileHtml.match(
            /<a\b(?=[^>]*href=["'][^"']*\/games\/?(?:\?[^"']*)?["'])[^>]*>([\s\S]*?)<\/a>/i
          );
          const gamesLinkCount = gamesLink?.[1]?.match(
            /<span\b(?=[^>]*class=["'][^"']*\bprofile_count_link_total\b[^"']*["'])[^>]*>\s*([\d,]+)\s*<\/span>/i
          );
          const countMatch = gamesLinkCount ||
            plainText.match(/\b([\d,]+)\s+Games\s+Owned\b/i) ||
            plainText.match(/\bGames\s+Owned\s*[:\-]?\s*([\d,]+)\b/i);
          if (countMatch) {
            const parsedCount = Number(countMatch[1].replace(/,/g, ""));
            if (Number.isSafeInteger(parsedCount) && parsedCount >= 0) {
              gameCollectorGamesCount = parsedCount;
            }
          }
        }
      } catch (profilePageError) {
        console.warn("Could not read Steam Game Collector showcase count:", profilePageError.message || profilePageError);
      }
    }
    const displayedGamesCount = gameCollectorGamesCount ?? (games ? games.length : null);
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
      bans,
      profileCustomization: customization ? { theme: customization.profile_theme || "", showcaseCount: Array.isArray(customization.slots) ? customization.slots.length : 0 } : null,
      favoriteBadge,
      yearOfService: yearOfService ? { level: Number(yearOfService.level) || 1, image: "https://community.fastly.steamstatic.com/public/images/badges/02_years/steamyears" + (Number(yearOfService.level) || 1) + "_80.png", xp: Number(yearOfService.xp) || 0 } : null,
      gameCollector: gameCollector ? { level: Number(gameCollector.level) || 1, xp: Number(gameCollector.xp) || 0, image: gameCollectorImage } : null,
      stats: {
        games: displayedGamesCount,
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
}
