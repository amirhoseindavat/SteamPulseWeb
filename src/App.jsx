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
import SalesPage from "./pages/SalesPage";
import { REGIONS } from "./config/regions";
import { money, formatNumber } from "./utils/formatters";
import { readApiResponse } from "./utils/api";
import { useSteamAccount } from "./hooks/useSteamAccount";
import { useDiscoveryData } from "./hooks/useDiscoveryData";
import { useGameOwnership } from "./hooks/useGameOwnership";
import { useSteamProfile } from "./hooks/useSteamProfile";
import { useGameSearch } from "./hooks/useGameSearch";
import { useMarketData } from "./hooks/useMarketData";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

const GAME_SECTION_SLUGS = {
  topSellers: "TopSellers",
  upcoming: "ComingSoon",
  newReleases: "NewReleases",
  preorders: "Preorders"
};

function getGamesSectionFromRoute(route) {
  const match = route.match(/^\/games\/([^/?#]+)\/?$/i);
  const section = match?.[1]?.toLowerCase();
  return ({
    topsellers: "topSellers",
    comingsoon: "upcoming",
    newreleases: "newReleases",
    preorders: "preorders"
  })[section] || "topSellers";
}

function getRoutePath() {
  const fallbackRoute = new URLSearchParams(window.location.search).get("p");
  if (fallbackRoute) {
    const route = fallbackRoute.startsWith("/") ? fallbackRoute : `/${fallbackRoute}`;
    window.history.replaceState(null, "", `${BASE_PATH}${route}`);
    return route;
  }
  if (window.location.hash.startsWith("#/")) {
    const route = window.location.hash.slice(1);
    window.history.replaceState(null, "", `${BASE_PATH}${route}`);
    return route;
  }
  const pathname = window.location.pathname;
  const route = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname;
  return route || "/";
}

export default function App() {
  const initialRoute = getRoutePath();
  const [region, setRegion] = useState(() => localStorage.getItem("steampulse-region") || "US");
  const [steamProfile, setSteamProfile] = useState(() => localStorage.getItem("steampulse-profile") || "");
  const [steamProfileDraft, setSteamProfileDraft] = useState(() => localStorage.getItem("steampulse-profile") || "");
  const [profileRouteId, setProfileRouteId] = useState(() => {
    const match = initialRoute.match(/^\/profile\/([^/?#]+)\/?$/);
    return match ? match[1] : "";
  });
  const [steamApiKey, setSteamApiKey] = useState(() => localStorage.getItem("steampulse-api-key") || "");
  const [steamApiKeyDraft, setSteamApiKeyDraft] = useState(() => localStorage.getItem("steampulse-api-key") || "");
  const [currentPage, setCurrentPage] = useState(() => {
    const gameMatch = initialRoute.match(/^\/game\/(\d+)/);
    const pageMatch = initialRoute.match(/^\/(home|games|trending|market|sales|calculator|cart|settings|profile)(?:\/[^/?#]+)?\/?$/);
    return gameMatch ? "game" : (pageMatch?.[1] === "trending" ? "games" : (pageMatch?.[1] || "home"));
  });
  const [gamesSection, setGamesSection] = useState(() => getGamesSectionFromRoute(initialRoute));
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("steampulse-theme") || "dark");
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
  const [conversionMode, setConversionMode] = useState("currency-to-keys");
  const [conversionAmount, setConversionAmount] = useState("18");
  const calculatorRef = useRef(null);
  const gameRequestRef = useRef(0);
  const searchRef = useRef(null);
  const headerSearchRef = useRef(null);

  const { steamAccountSnapshot, steamAccountData, steamAccountConnected, steamWishlist, steamOwnedApps, steamOwnedPackages, steamCartApps, steamCartDetails, steamCartDetailsLoading, steamCartDetailsError } = useSteamAccount(region);
  const { discovery, discoveryLoading, discoveryError, setDiscoveryLoading, setDiscoveryError, setDiscovery, freeGames, freeGamesLoading, setFreeGamesLoading, freeGamesError, setFreeGamesError, setFreeGames } = useDiscoveryData(region);
  const {
    steamProfileData, personalSteamProfileData, setPersonalSteamProfileData,
    steamProfileLoading, steamProfileError, loadSteamProfile, isOwnSteamProfile
  } = useSteamProfile({ currentPage, profileRouteId, setProfileRouteId, steamProfile, steamApiKey });
  const {
    shopData, shopDataLoading, shopDataError, shopDataUpdatedAt,
    regionalKeyPrice, regionalMarketData, regionalMarketLoading,
    regionalMarketError, regionalMarketUpdatedAt, refreshShopData
  } = useMarketData(region, currentPage);
  const {
    results, setResults, searchOpen, setSearchOpen, searching,
    searchGames, onSearchChange, chooseGame
  } = useGameSearch({ region, loadGame, setQuery, setInputId, setError });


  useEffect(() => {
    const pageTitles = { home: "Home", games: ({ topSellers: "Top Sellers", upcoming: "Coming Soon", newReleases: "New Releases", preorders: "Preorders" })[gamesSection] || "Games", market: "Market", sales: "Sales", calculator: "Key Calculator", cart: "Shopping Cart", settings: "Settings", profile: "Profile" };
    const title = currentPage === "game" && game?.name ? game.name : (pageTitles[currentPage] || "Home");
    document.title = `${title} | SteamPulse`;
  }, [currentPage, gamesSection, game?.name]);

  function navigateTo(page) {
    const nextPath = page === "game" && appid
      ? `/game/${appid}`
      : page === "profile" && personalSteamProfileData?.profile?.steamId
        ? `/profile/${personalSteamProfileData.profile.steamId}`
        : page === "games" || page === "trending"
          ? `/games/${GAME_SECTION_SLUGS.topSellers}`
          : `/${page}`;
    if (getRoutePath() !== nextPath) window.history.pushState(null, "", `${BASE_PATH}${nextPath}`);
    setCurrentPage(page === "trending" ? "games" : page);
    if (page === "games" || page === "trending") setGamesSection("topSellers");
    setProfileRouteId("");
    if (page !== "game") { setGame(null); setGameBackground(null); setError(""); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateToGamesSection(section) {
    const safeSection = GAME_SECTION_SLUGS[section] ? section : "topSellers";
    const nextPath = `/games/${GAME_SECTION_SLUGS[safeSection]}`;
    if (getRoutePath() !== nextPath) window.history.pushState(null, "", `${BASE_PATH}${nextPath}`);
    setCurrentPage("games");
    setGamesSection(safeSection);
    setProfileRouteId("");
    setGame(null);
    setGameBackground(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadGame(id = appid, cc = region) {
    if (!/^\d+$/.test(String(id))) {
      setError("Enter a valid numeric Steam AppID.");
      return;
    }
    setCurrentPage("game");
    if (getRoutePath() !== `/game/${id}`) window.history.pushState(null, "", `${BASE_PATH}/game/${id}`);
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

  useEffect(() => {
    const syncPageFromLocation = () => {
      const route = getRoutePath();
      const gameMatch = route.match(/^\/game\/(\d+)/);
      if (gameMatch) {
        setCurrentPage("game");
        const targetId = gameMatch[1];
        if (String(game?.appid || "") !== targetId && !loading) loadGame(targetId, region);
        return;
      }
      const pageMatch = route.match(/^\/(home|games|trending|market|sales|calculator|cart|settings|profile)(?:\/([^/?#]+))?\/?$/);
      const routePage = pageMatch?.[1] || "home";
      const nextPage = routePage === "trending" ? "games" : routePage;
      setCurrentPage(nextPage);
      setGamesSection(routePage === "trending" ? "topSellers" : getGamesSectionFromRoute(route));
      if (routePage === "trending" || (routePage === "games" && !pageMatch?.[2])) window.history.replaceState(null, "", `${BASE_PATH}/games/${GAME_SECTION_SLUGS.topSellers}`);
      setProfileRouteId(nextPage === "profile" ? (pageMatch?.[2] || "") : "");
      if (nextPage !== "game") { setGame(null); setGameBackground(null); setLoading(false); }
    };
    window.addEventListener("popstate", syncPageFromLocation);
    window.addEventListener("hashchange", syncPageFromLocation);
    if (getRoutePath() !== "/") syncPageFromLocation();
    return () => {
      window.removeEventListener("popstate", syncPageFromLocation);
      window.removeEventListener("hashchange", syncPageFromLocation);
    };
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (!searchRef.current?.contains(event.target) && !headerSearchRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, []);

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
    resetOwnership();
  }

  const { ownership, ownershipLoading, ownershipError, resetOwnership } = useGameOwnership({
    game,
    currentPage,
    steamProfile,
    steamApiKey
  });

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

        {currentPage === "sales" && <SalesPage />}

        {currentPage === "market" && <MarketPage shopDataError={shopDataError} shopDataLoading={shopDataLoading} regionalMarketError={regionalMarketError} regionalMarketLoading={regionalMarketLoading} regionalMarketData={regionalMarketData} regionalMarketUpdatedAt={regionalMarketUpdatedAt} shopData={shopData} shopDataUpdatedAt={shopDataUpdatedAt} region={region} onRefresh={refreshShopData} />}

        {currentPage === "home" && <HomePage
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
          loading={loading}
          freeGamesLoading={freeGamesLoading}
          setFreeGamesLoading={setFreeGamesLoading}
          freeGamesError={freeGamesError}
          setFreeGamesError={setFreeGamesError}
          setFreeGames={setFreeGames}
        />}
        {currentPage === "games" && <TrendingPage
          discovery={discovery}
          discoveryLoading={discoveryLoading}
          discoveryError={discoveryError}
          activeSection={gamesSection}
          onNavigateSection={navigateToGamesSection}
          setDiscoveryLoading={setDiscoveryLoading}
          setDiscoveryError={setDiscoveryError}
          setDiscovery={setDiscovery}
          readApiResponse={readApiResponse}
          region={region}
          setQuery={setQuery}
          setInputId={setInputId}
          loadGame={loadGame}
        />}


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
