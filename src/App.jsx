import { useEffect, useRef, useState } from "react";
import AppHeader from "./components/AppHeader";
import SiteFooter from "./components/SiteFooter";
import SettingsPage from "./pages/SettingsPage";
import CalculatorPage from "./pages/CalculatorPage";
import CartPage from "./pages/CartPage";
import MarketPage from "./pages/MarketPage";
import TrendingPage from "./pages/TrendingPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import GamePage from "./pages/GamePage";
import { REGIONS } from "./config/regions";
import { money, formatNumber } from "./utils/formatters";
import { hasCompleteReleaseDate } from "./utils/releaseDate";
import RegionSelect from "./components/RegionSelect";
import SteamDeckMark from "./components/SteamDeckMark";
import DeckCompatibilityIcon from "./components/DeckCompatibilityIcon";
import ReleaseCountdown from "./components/ReleaseCountdown";
import Strip from "./components/Strip";
import {
  Search, Gamepad2, Activity, CalendarDays, ExternalLink, Monitor, Apple, Settings, Save, Library, ShieldCheck, UserRound, Trophy, Clock3, UsersRound, Calculator, Heart, PackageOpen, ShoppingCart,
  Star, Users, Tag, ChevronRight, LoaderCircle, X, RefreshCw, Globe2, Gift,
  Sparkles, Image as ImageIcon, Info, CheckCircle2, AlertTriangle, CircleHelp, CircleX, Sun, Moon
} from "lucide-react";

export default function App() {
  const [region, setRegion] = useState(() => localStorage.getItem("steampulse-region") || "US");
  const [steamProfile, setSteamProfile] = useState(() => localStorage.getItem("steampulse-profile") || "");
  const [steamProfileDraft, setSteamProfileDraft] = useState(() => localStorage.getItem("steampulse-profile") || "");
  const [profileRouteId, setProfileRouteId] = useState(() => {
    const match = window.location.hash.match(/^#\/profile\/([^/?#]+)\/?$/);
    return match ? match[1] : "";
  });
  const [steamApiKey, setSteamApiKey] = useState(() => localStorage.getItem("steampulse-api-key") || "");
  const [steamApiKeyDraft, setSteamApiKeyDraft] = useState(() => localStorage.getItem("steampulse-api-key") || "");
  const [steamAccountSnapshot, setSteamAccountSnapshot] = useState(null);
  const [steamCartDetails, setSteamCartDetails] = useState([]);
  const [steamCartDetailsLoading, setSteamCartDetailsLoading] = useState(false);
  const [steamCartDetailsError, setSteamCartDetailsError] = useState("");
  const [ownership, setOwnership] = useState(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState("");
  const [steamProfileData, setSteamProfileData] = useState(null);
  const [personalSteamProfileData, setPersonalSteamProfileData] = useState(null);
  const [steamProfileLoading, setSteamProfileLoading] = useState(false);
  const [steamProfileError, setSteamProfileError] = useState("");
  const [currentPage, setCurrentPage] = useState(() => { const match = window.location.hash.match(/^#\/game\/(\d+)/); return match ? "game" : (window.location.hash.match(/^#\/(home|games|trending|market|calculator|cart|settings|profile)(?:\/\d{17})?\/?$/)?.[1] || "home"); });
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("steampulse-theme") || "dark");
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [appid, setAppid] = useState("");
  const [inputId, setInputId] = useState("");
  const [game, setGame] = useState(null);
  const [gameBackground, setGameBackground] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMoreDlc, setLoadingMoreDlc] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [regionalPriceInput, setRegionalPriceInput] = useState("");
  const [selectedEditionName, setSelectedEditionName] = useState("");
  const [purchaseTab, setPurchaseTab] = useState("editions");
  const [discovery, setDiscovery] = useState({ newReleases: [], upcoming: [], preorders: [], preordersError: "", topSellers: [] });
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryTab, setDiscoveryTab] = useState("trending");
  const [freeGames, setFreeGames] = useState([]);
  const [freeGamesLoading, setFreeGamesLoading] = useState(true);
  const [freeGamesError, setFreeGamesError] = useState("");
  const [shopData, setShopData] = useState(null);
  const [shopDataLoading, setShopDataLoading] = useState(false);
  const [shopDataError, setShopDataError] = useState("");
  const [shopDataUpdatedAt, setShopDataUpdatedAt] = useState(null);
  const [regionalKeyPrice, setRegionalKeyPrice] = useState(null);
  const [conversionMode, setConversionMode] = useState("currency-to-keys");
  const [conversionAmount, setConversionAmount] = useState("18");
  const [regionalMarketData, setRegionalMarketData] = useState([]);
  const [regionalMarketLoading, setRegionalMarketLoading] = useState(false);
  const [regionalMarketError, setRegionalMarketError] = useState("");
  const [regionalMarketUpdatedAt, setRegionalMarketUpdatedAt] = useState(null);
  const calculatorRef = useRef(null);
  const gameRequestRef = useRef(0);
  const searchRef = useRef(null);
  const headerSearchRef = useRef(null);
  const debounceRef = useRef(null);


  useEffect(() => {
    const pageTitles = { home: "Home", games: "Games", trending: "Trending", market: "Market", calculator: "Key Calculator", cart: "Shopping Cart", settings: "Settings", profile: "Profile" };
    const title = currentPage === "game" && game?.name ? game.name : (pageTitles[currentPage] || "Home");
    document.title = `${title} | SteamPulse`;
  }, [currentPage, game?.name]);

  function navigateTo(page) {
    const nextHash = page === "game" && appid ? `#/game/${appid}` : page === "profile" && personalSteamProfileData?.profile?.steamId ? `#/profile/${personalSteamProfileData.profile.steamId}` : `#/${page}`;
    if (window.location.hash !== nextHash) window.history.pushState(null, "", nextHash);
    setCurrentPage(page);
    setProfileRouteId("");
    if (page !== "game") { setGame(null); setGameBackground(null); setError(""); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function readApiResponse(response) {
    const text = await response.text();
    if (!text.trim()) {
      throw new Error("The SteamPulse API returned an empty response. Make sure both the Vite client and Express server are running with npm run dev.");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("The API returned a non-JSON response. Open the app through the Vite dev server and check that the Express API is running on port 3001.");
    }
  }

  async function loadGame(id = appid, cc = region) {
    if (!/^\d+$/.test(String(id))) {
      setError("Enter a valid numeric Steam AppID.");
      return;
    }
    setCurrentPage("game");
    if (window.location.hash !== `#/game/${id}`) window.history.pushState(null, "", `#/game/${id}`);
    const requestId = ++gameRequestRef.current;
    setLoading(true);
    setError("");
    setSearchOpen(false);
    // Hide the previous game's details immediately so stale art never remains visible.
    setGame(null);
    setGameBackground(null);
    setRegionalPriceInput("");
    setSelectedEditionName("");
    setPurchaseTab("editions");
    try {
      const response = await fetch(`/api/game/${id}?cc=${cc}`);
      const data = await readApiResponse(response);
      if (requestId !== gameRequestRef.current) return;
      if (!response.ok) throw new Error(data.error || data.detail || "Unable to load this game.");
      setGame(data);
      const isDlcPage = String(data.type || "").toLowerCase() === "dlc";
      const randomScreenshot = Array.isArray(data.screenshots) && data.screenshots.length
        ? data.screenshots[Math.floor(Math.random() * data.screenshots.length)]
        : null;
      const preferredBackground = isDlcPage
        ? (randomScreenshot || data.background_raw || null)
        : (typeof data.background_raw === "string" && /page_bg_raw/i.test(data.background_raw)
          ? data.background_raw
          : (randomScreenshot || data.background_raw || null));
      setGameBackground(preferredBackground);
      // Keep the base game's default Steam edition selected in the purchase options.
      const baseGamePrice = data.price_overview?.final != null ? Number(data.price_overview.final) / 100 : null;
      const defaultEdition = (data.editions || []).find((edition) =>
        edition.priceValue != null && baseGamePrice != null &&
        Math.abs(Number(edition.priceValue) - baseGamePrice) < 0.01
      ) || (data.editions || []).find((edition) => edition.priceValue != null);
      setSelectedEditionName(defaultEdition?.name?.replace(/\s*-\s*\$\s*$/, "") || "");
      // Bundle discovery can be slow on some Steam pages; load it after the main game details.
      if (String(data.type || "").toLowerCase() !== "dlc") {
        fetch(`/api/game/${id}/bundles?cc=${cc}`)
          .then((response) => response.ok ? response.json() : null)
          .then((bundleData) => {
            if (!bundleData || !Array.isArray(bundleData.bundles)) return;
            if (requestId !== gameRequestRef.current) return;
            setGame((current) => String(current?.appid) === String(id)
              ? { ...current, bundles: bundleData.bundles, franchise: bundleData.franchise || null }
              : current);
          })
          .catch(() => {});
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      setRegionalPriceInput(data.price_overview?.final != null ? (data.price_overview.final / 100).toFixed(2) : "");
      setAppid(String(id));
      setInputId(String(id));
      setQuery(data.name);
      setActiveTab("overview");
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreDlc() {
    if (!game || loadingMoreDlc || !(game.dlc_has_more ?? (game.dlc.length < game.dlc_total))) return;
    setLoadingMoreDlc(true);
    setError("");
    try {
      // Use the source-list cursor, not the number of successfully rendered cards.
      // Some Steam DLC appdetails requests fail, so rendered count is not a reliable offset.
      const offset = Number.isSafeInteger(Number(game.dlc_next_offset))
        ? Number(game.dlc_next_offset)
        : game.dlc.length;
      const response = await fetch(`/api/game/${game.appid}/dlc?cc=${region}&offset=${offset}&limit=24`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || data.detail || "Unable to load more DLC.");
      setGame((current) => {
        if (!current || String(current.appid) !== String(game.appid)) return current;
        const existing = new Set((current.dlc || []).map((item) => String(item.appid)));
        const newItems = (data.items || []).filter((item) => !existing.has(String(item.appid)));
        return {
          ...current,
          dlc: [...(current.dlc || []), ...newItems],
          dlc_total: data.total ?? current.dlc_total,
          dlc_next_offset: data.nextOffset ?? offset + 24,
          dlc_has_more: data.hasMore ?? ((data.nextOffset ?? offset + 24) < (data.total ?? current.dlc_total))
        };
      });
    } catch (e) {
      setError(e.message || "Could not load more DLC.");
    } finally {
      setLoadingMoreDlc(false);
    }
  }

  async function searchGames(term) {
    if (term.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/search?term=${encodeURIComponent(term.trim())}&cc=${region}`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || data.detail || "Search failed.");
      setResults(data.items || []);
      setSearchOpen(true);
    } catch (e) {
      setResults([]);
      setError(e.message || "Steam search failed. Check that the API server is running.");
    } finally {
      setSearching(false);
    }
  }

  function onSearchChange(value) {
    setQuery(value);
    setSearchOpen(true);
    clearTimeout(debounceRef.current);
    if (/^\d+$/.test(value.trim())) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => searchGames(value), 300);
  }

  function chooseGame(item) {
    setQuery(item.name);
    setInputId(String(item.id));
    setSearchOpen(false);
    loadGame(item.id, region);
  }

  useEffect(() => {
    const syncPageFromHash = () => {
      const hash = window.location.hash;
      const gameMatch = hash.match(/^#\/game\/(\d+)/);
      if (gameMatch) {
        setCurrentPage("game");
        const targetId = gameMatch[1];
        if (String(game?.appid || "") !== targetId && !loading) loadGame(targetId, region);
        return;
      }
      const pageMatch = hash.match(/^#\/(home|games|trending|market|calculator|cart|settings|profile)(?:\/([^/?#]+))?\/?$/);
      const nextPage = pageMatch?.[1] || "home";
      setCurrentPage(nextPage);
      setProfileRouteId(nextPage === "profile" ? (pageMatch?.[2] || "") : "");
      if (nextPage !== "game") { setGame(null); setGameBackground(null); setLoading(false); }
    };
    window.addEventListener("popstate", syncPageFromHash);
    if (window.location.hash) syncPageFromHash();
    return () => window.removeEventListener("popstate", syncPageFromHash);
  }, []);

  useEffect(() => {
    const receiveSteamAccount = (event) => {
      if (event.source !== window || event.data?.source !== "STEAMPULSE_CONNECT" || event.data?.type !== "ACCOUNT_SNAPSHOT") return;
      setSteamAccountSnapshot(event.data.snapshot || null);
    };
    const requestSteamAccount = (refresh = false) => {
      window.postMessage({ source: "STEAMPULSE_PAGE", type: refresh ? "REFRESH_ACCOUNT_SNAPSHOT" : "GET_ACCOUNT_SNAPSHOT" }, window.location.origin);
    };
    window.addEventListener("message", receiveSteamAccount);
    requestSteamAccount();
    requestSteamAccount(true);
    const syncTimer = window.setInterval(() => requestSteamAccount(true), 60000);
    return () => {
      window.removeEventListener("message", receiveSteamAccount);
      window.clearInterval(syncTimer);
    };
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (!searchRef.current?.contains(event.target) && !headerSearchRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentPage === "profile" || steamProfile.trim()) loadSteamProfile(profileRouteId || steamProfile);
  }, [currentPage, steamProfile, profileRouteId]);

  useEffect(() => {
    localStorage.setItem("steampulse-region", region);
    if (game) loadGame(appid, region);
  }, [region]);

  function saveSettings() {
    const cleanProfile = steamProfileDraft.trim();
    setSteamProfile(cleanProfile);
    setPersonalSteamProfileData(null);
    localStorage.setItem("steampulse-profile", cleanProfile);
    const cleanApiKey = steamApiKeyDraft.trim();
    setSteamApiKey(cleanApiKey);
    localStorage.setItem("steampulse-api-key", cleanApiKey);
    localStorage.setItem("steampulse-region", region);
    setOwnership(null);
    setOwnershipError("");
  }

  async function loadSteamProfile(profileOverride = "") {
    const targetProfile = String(profileOverride || steamProfile || "").trim();
    if (!targetProfile) {
      setSteamProfileData(null);
      setSteamProfileError("Add your Steam profile in Settings first, then save it.");
      return;
    }
    setSteamProfileLoading(true);
    setSteamProfileError("");
    setSteamProfileData(null);
    try {
      const response = await fetch(`/api/steam-profile?profile=${encodeURIComponent(targetProfile)}`, { headers: steamApiKey ? { "X-Steam-API-Key": steamApiKey } : {} });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not load the Steam profile.");
      setSteamProfileData(data);
      if (targetProfile === String(steamProfile || "").trim()) setPersonalSteamProfileData(data);
    } catch (e) {
      setSteamProfileError(e.message || "Could not load the Steam profile.");
    } finally {
      setSteamProfileLoading(false);
    }
  }


  useEffect(() => {
    if (currentPage !== "profile" || profileRouteId || !personalSteamProfileData?.profile?.steamId) return;
    const ownProfileHash = `#/profile/${personalSteamProfileData.profile.steamId}`;
    if (window.location.hash !== ownProfileHash) window.history.replaceState(null, "", ownProfileHash);
    setProfileRouteId(personalSteamProfileData.profile.steamId);
  }, [currentPage, profileRouteId, personalSteamProfileData?.profile?.steamId]);

  // When a profile URL is opened directly, resolve the saved account separately
  // so we can reliably distinguish the signed-in user's profile from another user.
  useEffect(() => {
    if (currentPage !== "profile" || !profileRouteId || !steamProfile.trim()) return;
    if (personalSteamProfileData?.profile?.steamId) return;
    let cancelled = false;
    fetch(`/api/steam-profile?profile=${encodeURIComponent(steamProfile.trim())}`, {
      headers: steamApiKey ? { "X-Steam-API-Key": steamApiKey } : {}
    })
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not resolve the saved Steam profile.");
        return data;
      })
      .then((data) => {
        if (!cancelled) setPersonalSteamProfileData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentPage, profileRouteId, steamProfile, steamApiKey, personalSteamProfileData?.profile?.steamId]);

  async function checkOwnership() {
    if (!steamProfile.trim() || !game) {
      setOwnershipError("Add your Steam profile in Settings first.");
      return;
    }
    setOwnershipLoading(true);
    setOwnershipError("");
    try {
      const appids = [...new Set([Number(game.appid), ...(game.dlc || []).map((item) => Number(item.appid))].filter(Number.isFinite))];
      const response = await fetch("/api/ownership-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(steamApiKey ? { "X-Steam-API-Key": steamApiKey } : {}) },
        body: JSON.stringify({ profile: steamProfile, appids })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not check this Steam library.");
      setOwnership(data);
    } catch (e) {
      setOwnershipError(e.message || "Ownership check failed.");
    } finally {
      setOwnershipLoading(false);
    }
  }

  useEffect(() => {
    if (currentPage === "game" && game?.appid && game.type !== "dlc" && steamProfile && steamApiKey) checkOwnership();
  }, [currentPage, game?.appid, steamProfile, steamApiKey]);

  useEffect(() => {
    let cancelled = false;
    setDiscoveryLoading(true);
    setDiscoveryError("");
    fetch(`/api/discover?cc=${region}`)
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || data.detail || "Could not load game discovery.");
        return data;
      })
      .then((data) => {
        if (!cancelled) setDiscovery({
          newReleases: data.newReleases || [],
          upcoming: data.upcoming || [],
          preorders: data.preorders || [],
          preordersError: data.preordersError || "",
          topSellers: data.topSellers || []
        });
      })
      .catch((e) => {
        if (!cancelled) setDiscoveryError(e.message || "Game discovery is temporarily unavailable.");
      })
      .finally(() => { if (!cancelled) setDiscoveryLoading(false); });
    return () => { cancelled = true; };
  }, [region]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const loadShopData = async () => {
      setShopDataLoading(true);
      setShopDataError("");
      try {
        const response = await fetch("/api/shop-data");
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load live key prices.");
        const keyPrice = Number(String(data.Key ?? "").replace(/[\s,٬]/g, ""));
        if (!Number.isFinite(keyPrice) || keyPrice <= 0) throw new Error("The shop API returned an invalid key price.");
        if (!cancelled) { setShopData({ ...data, Key: keyPrice }); setShopDataUpdatedAt(new Date()); }
      } catch (error) {
        if (!cancelled) setShopDataError(error.message || "Live key prices are temporarily unavailable.");
      } finally {
        if (!cancelled) setShopDataLoading(false);
      }
    };
    loadShopData();
    timer = setInterval(loadShopData, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const loadRegionalKeyPrice = async () => {
      try {
        const response = await fetch(`/api/key-price?region=${encodeURIComponent(region)}`);
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load this region's Steam key price.");
        if (!cancelled) setRegionalKeyPrice(data);
      } catch (error) {
        if (!cancelled) setRegionalKeyPrice({ region, error: error.message || "Steam key price unavailable." });
      }
    };
    setRegionalKeyPrice(null);
    loadRegionalKeyPrice();
    timer = setInterval(loadRegionalKeyPrice, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [region]);

  useEffect(() => {
    if (currentPage !== "market") return;
    let cancelled = false;
    const loadRegionalMarket = async () => {
      setRegionalMarketLoading(true);
      setRegionalMarketError("");
      try {
        const response = await fetch("/api/market-regions");
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load Steam Market regional prices.");
        if (!cancelled) {
          setRegionalMarketData(Array.isArray(data.regions) ? data.regions : []);
          setRegionalMarketUpdatedAt(new Date());
        }
      } catch (error) {
        if (!cancelled) setRegionalMarketError(error.message || "Steam Market data is temporarily unavailable.");
      } finally {
        if (!cancelled) setRegionalMarketLoading(false);
      }
    };
    loadRegionalMarket();
    const timer = setInterval(loadRegionalMarket, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;
    setFreeGamesLoading(true);
    setFreeGamesError("");
    fetch(`/api/free-games?cc=${region}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load free Steam games.");
        return data;
      })
      .then((data) => { if (!cancelled) setFreeGames(data.items || []); })
      .catch((e) => { if (!cancelled) setFreeGamesError(e.message || "Free promotions are temporarily unavailable."); })
      .finally(() => { if (!cancelled) setFreeGamesLoading(false); });
    return () => { cancelled = true; };
  }, [region]);

  const steamAccountData = steamAccountSnapshot?.data || null;
  const steamAccountConnected = steamAccountSnapshot?.loginStatus === "connected";
  const steamWishlist = new Set((steamAccountData?.rgWishlist || []).map(Number));
  const steamOwnedApps = new Set((steamAccountData?.rgOwnedApps || []).map(Number));
  const steamOwnedPackages = new Set((steamAccountData?.rgOwnedPackages || []).map(Number));
  const steamCartApps = (steamAccountData?.rgAppsInCart || []).map(Number);
  const isOwnSteamProfile = Boolean(
    steamProfileData?.profile?.steamId &&
    (
      steamProfileData.profile.steamId === personalSteamProfileData?.profile?.steamId ||
      (/^\d{17}$/.test(steamProfile.trim()) && steamProfileData.profile.steamId === steamProfile.trim())
    )
  );

  useEffect(() => {
    let cancelled = false;
    const appIds = [...new Set(steamCartApps.filter((id) => Number.isSafeInteger(id) && id > 0))].join(",");
    if (!steamAccountConnected || !appIds) {
      setSteamCartDetails([]);
      setSteamCartDetailsError("");
      setSteamCartDetailsLoading(false);
      return () => { cancelled = true; };
    }

    setSteamCartDetailsLoading(true);
    setSteamCartDetailsError("");
    fetch(`/api/cart-details?cc=${encodeURIComponent(region)}&apps=${encodeURIComponent(appIds)}`)
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load cart details.");
        return data;
      })
      .then((data) => {
        if (!cancelled) setSteamCartDetails(data.items || []);
      })
      .catch((error) => {
        if (!cancelled) setSteamCartDetailsError(error.message || "Cart details are temporarily unavailable.");
      })
      .finally(() => {
        if (!cancelled) setSteamCartDetailsLoading(false);
      });

    return () => { cancelled = true; };
  }, [steamAccountConnected, steamCartApps.join(","), region]);


  const gamePackageIds = [...new Set((game?.package_ids || game?.editions?.map((edition) => edition.packageId) || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  const allGameEditions = game?.editions || [];
  const gameEditions = allGameEditions;
  const gameBundles = game?.bundles || [];
  const hasEditions = gameEditions.length > 0;
  const hasBundles = gameBundles.length > 0;
  const missingPackages = gamePackageIds
    .filter((packageId) => !allGameEditions.some((edition) => Number(edition.packageId) === packageId))
    .map((packageId) => ({ packageId, name: `Steam package ${packageId}`, description: "Owned package detected in your Steam account.", url: `https://store.steampowered.com/sub/${packageId}/` }));
  const visibleDlc = game?.dlc || [];
  // Count ownership against every DLC AppID, not only the 24 cards currently loaded.
  const allDlcIds = [...new Set((game?.dlc_ids || visibleDlc.map((item) => item.appid))
    .map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  const ownedDlcCount = steamAccountConnected
    ? allDlcIds.filter((id) => steamOwnedApps.has(id) || steamOwnedPackages.has(id)).length
    : 0;
  const totalDlcCount = Math.max(Number(game?.dlc_total) || 0, visibleDlc.length);
  const dlcSectionCount = ownedDlcCount > 0
    ? `${totalDlcCount} DLCs · ${ownedDlcCount} owned`
    : `${totalDlcCount} DLCs`;
  const gameIsWishlisted = Boolean(game && steamAccountConnected && steamWishlist.has(Number(game.appid)));
  const gameIsOwned = Boolean(game && steamAccountConnected && (
    steamOwnedApps.has(Number(game.appid)) || gamePackageIds.some((packageId) => steamOwnedPackages.has(packageId))
  ));
  const hero = game?.library_hero || game?.header_image_2x || game?.header_image;
  const price = money(game?.price_overview);
  const hasStorePrice = Boolean(game?.price_overview && (game.price_overview.final != null || game.price_overview.final_formatted));
  const selectedRegion = REGIONS.find((r) => r.code === region) || REGIONS[0];
  const numericRegionalPrice = Number(regionalPriceInput);
  const regionalKeyPriceValue = Number(regionalKeyPrice?.netPrice);
  const regionalKeyPriceForCalculation = regionalKeyPrice?.region === selectedRegion.code && Number.isFinite(regionalKeyPriceValue) && regionalKeyPriceValue > 0 ? regionalKeyPriceValue : 0;
  const uniqueCartDetails = steamCartDetails;
  const cartCurrency = uniqueCartDetails.find((item) => item.currency)?.currency || selectedRegion.currency;
  const cartTotalMinor = uniqueCartDetails.reduce((sum, item) => sum + (item.price != null && Number.isFinite(Number(item.price)) ? Number(item.price) : 0), 0);
  const cartOriginalTotalMinor = uniqueCartDetails.reduce((sum, item) => sum + (item.initialPrice != null && Number.isFinite(Number(item.initialPrice)) ? Number(item.initialPrice) : (item.price != null && Number.isFinite(Number(item.price)) ? Number(item.price) : 0)), 0);
  const cartPricedItems = uniqueCartDetails.filter((item) => item.price != null && Number.isFinite(Number(item.price)));
  const cartTotalFormatted = cartPricedItems.length
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: cartCurrency }).format(cartTotalMinor / 100)
    : "—";
  const cartOriginalTotalFormatted = cartPricedItems.length
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: cartCurrency }).format(cartOriginalTotalMinor / 100)
    : "—";
  const cartSavingsMinor = Math.max(0, cartOriginalTotalMinor - cartTotalMinor);
  const cartSavingsFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: cartCurrency }).format(cartSavingsMinor / 100);
  const cartKeyCount = regionalKeyPriceForCalculation > 0 && cartPricedItems.length
    ? Math.ceil((cartTotalMinor / 100) / regionalKeyPriceForCalculation)
    : null;

  const keyCount = regionalPriceInput.trim() !== "" && regionalKeyPriceForCalculation > 0 && Number.isFinite(numericRegionalPrice) && numericRegionalPrice > 0 ? Math.ceil(numericRegionalPrice / regionalKeyPriceForCalculation) : 0;
  const liveKeyPriceToman = Number(shopData?.Key);
  const conversionValue = Number(conversionAmount);
  const conversionValid = conversionAmount.trim() !== "" && Number.isFinite(conversionValue) && conversionValue > 0;
  const conversionResult = !conversionValid ? null : conversionMode === "currency-to-keys" ? (regionalKeyPriceForCalculation > 0 ? conversionValue / regionalKeyPriceForCalculation : null) : conversionMode === "toman-to-keys" ? (liveKeyPriceToman > 0 ? conversionValue / liveKeyPriceToman : null) : conversionMode === "keys-to-toman" ? (liveKeyPriceToman > 0 ? conversionValue * liveKeyPriceToman : null) : (regionalKeyPriceForCalculation > 0 ? conversionValue * regionalKeyPriceForCalculation : null);
  const conversionResultLabel = conversionMode === "currency-to-keys" || conversionMode === "toman-to-keys" ? "Keys" : conversionMode === "keys-to-toman" ? "toman" : selectedRegion.currency;
  const conversionResultFormatted = conversionResult == null ? null : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(conversionResult);
  const totalToman = keyCount * (Number.isFinite(liveKeyPriceToman) && liveKeyPriceToman > 0 ? liveKeyPriceToman : 0);
  const systemNames = Object.entries(game?.platforms || {}).filter(([, supported]) => supported).map(([name]) => name);
  const tabNames = ["overview", "screenshots", "videos", "requirements", "steam news", "external news"];

  return (
    <div className={`app-shell${gameBackground ? " has-game-background" : ""}`} data-theme={theme}>
      {gameBackground && <div className="game-background-blur" style={{ backgroundImage: `url("${gameBackground}")` }} aria-hidden="true" />}
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <AppHeader currentPage={currentPage} navigateTo={navigateTo} steamCartApps={steamCartApps} headerSearchRef={headerSearchRef} theme={theme} setTheme={setTheme} personalSteamProfileData={personalSteamProfileData} />

      <main className="main-content">
        {currentPage === "profile" && <ProfilePage
          steamProfileData={steamProfileData}
          steamProfileLoading={steamProfileLoading}
          steamProfileError={steamProfileError}
          steamAccountData={steamAccountData}
          steamWishlist={steamWishlist}
          isOwnSteamProfile={isOwnSteamProfile}
          navigateTo={navigateTo}
          loadSteamProfile={loadSteamProfile}
        />}

        {currentPage === "settings" && <SettingsPage region={region} setRegion={setRegion} steamProfileDraft={steamProfileDraft} setSteamProfileDraft={setSteamProfileDraft} saveSettings={saveSettings} steamProfile={steamProfile} steamApiKeyDraft={steamApiKeyDraft} setSteamApiKeyDraft={setSteamApiKeyDraft} />}

        {currentPage === "calculator" && <CalculatorPage region={region} setRegion={setRegion} conversionMode={conversionMode} setConversionMode={setConversionMode} conversionAmount={conversionAmount} setConversionAmount={setConversionAmount} selectedRegion={selectedRegion} conversionResult={conversionResult} conversionResultFormatted={conversionResultFormatted} conversionResultLabel={conversionResultLabel} regionalKeyPrice={regionalKeyPrice} regionalKeyPriceForCalculation={regionalKeyPriceForCalculation} liveKeyPriceToman={liveKeyPriceToman} shopDataError={shopDataError} />}

        {currentPage === "cart" && <CartPage steamCartApps={steamCartApps} steamAccountConnected={steamAccountConnected} steamCartDetailsError={steamCartDetailsError} steamCartDetailsLoading={steamCartDetailsLoading} uniqueCartDetails={uniqueCartDetails} cartTotalFormatted={cartTotalFormatted} cartOriginalTotalFormatted={cartOriginalTotalFormatted} cartSavingsMinor={cartSavingsMinor} cartSavingsFormatted={cartSavingsFormatted} cartKeyCount={cartKeyCount} region={region} regionalKeyPriceForCalculation={regionalKeyPriceForCalculation} cartCurrency={cartCurrency} />}

        {currentPage === "market" && <MarketPage shopDataError={shopDataError} shopDataLoading={shopDataLoading} regionalMarketError={regionalMarketError} regionalMarketLoading={regionalMarketLoading} regionalMarketData={regionalMarketData} regionalMarketUpdatedAt={regionalMarketUpdatedAt} shopData={shopData} shopDataUpdatedAt={shopDataUpdatedAt} region={region} onRefresh={() => { setShopDataLoading(true); setShopDataError(""); fetch("/api/shop-data").then(async (response) => { const data = await readApiResponse(response); if (!response.ok) throw new Error(data.error || "Could not load live key prices."); return data; }).then((data) => { setShopData(data); setShopDataUpdatedAt(new Date()); }).catch((error) => setShopDataError(error.message || "Refresh failed.")).finally(() => setShopDataLoading(false)); }} />}

        {(currentPage === "home" || currentPage === "games") && <HomePage
          currentPage={currentPage}
          query={query}
          onSearchChange={onSearchChange}
          searchRef={searchRef}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          searching={searching}
          results={results}
          setQuery={setQuery}
          setResults={setResults}
          loadGame={loadGame}
          chooseGame={chooseGame}
          searchGames={searchGames}
          inputId={inputId}
          setInputId={setInputId}
          discovery={discovery}
          discoveryLoading={discoveryLoading}
          discoveryError={discoveryError}
          region={region}
          setRegion={setRegion}
          freeGames={freeGames}
          freeGamesLoading={freeGamesLoading}
          setFreeGamesLoading={setFreeGamesLoading}
          freeGamesError={freeGamesError}
          setFreeGamesError={setFreeGamesError}
          setFreeGames={setFreeGames}
        />}
        {currentPage === "trending" && <TrendingPage
          discovery={discovery}
          discoveryLoading={discoveryLoading}
          discoveryError={discoveryError}
          discoveryTab={discoveryTab}
          setDiscoveryTab={setDiscoveryTab}
          setDiscoveryLoading={setDiscoveryLoading}
          setDiscoveryError={setDiscoveryError}
          setDiscovery={setDiscovery}
          readApiResponse={readApiResponse}
          region={region}
          setQuery={setQuery}
          setInputId={setInputId}
          loadGame={loadGame}
        />}se profile</div>
        </section>

        </>}

        {currentPage === "home" && !loading && <section className="welcome-panel"><Sparkles size={28} /><h2>Your next favorite game is out there</h2><p>Search the Steam catalog or open Trending to discover what’s hot and what’s free right now.</p></section>}

        <GamePage
          currentPage={currentPage}
          region={region}
          setRegion={setRegion}
          steamAccountSnapshot={steamAccountSnapshot}
          ownership={ownership}
          appid={appid}
          game={game}
          loading={loading}
          loadingMoreDlc={loadingMoreDlc}
          error={error}
          setError={setError}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          regionalPriceInput={regionalPriceInput}
          setRegionalPriceInput={setRegionalPriceInput}
          selectedEditionName={selectedEditionName}
          setSelectedEditionName={setSelectedEditionName}
          purchaseTab={purchaseTab}
          setPurchaseTab={setPurchaseTab}
          shopDataError={shopDataError}
          regionalKeyPrice={regionalKeyPrice}
          loadGame={loadGame}
          loadMoreDlc={loadMoreDlc}
          calculatorRef={calculatorRef}
          steamAccountConnected={steamAccountConnected}
          steamOwnedApps={steamOwnedApps}
          steamOwnedPackages={steamOwnedPackages}
          gameEditions={gameEditions}
          gameBundles={gameBundles}
          hasEditions={hasEditions}
          hasBundles={hasBundles}
          missingPackages={missingPackages}
          visibleDlc={visibleDlc}
          dlcSectionCount={dlcSectionCount}
          gameIsWishlisted={gameIsWishlisted}
          gameIsOwned={gameIsOwned}
          hero={hero}
          price={price}
          hasStorePrice={hasStorePrice}
          selectedRegion={selectedRegion}
          numericRegionalPrice={numericRegionalPrice}
          regionalKeyPriceForCalculation={regionalKeyPriceForCalculation}
          keyCount={keyCount}
          liveKeyPriceToman={liveKeyPriceToman}
          totalToman={totalToman}
          systemNames={systemNames}
          tabNames={tabNames}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
