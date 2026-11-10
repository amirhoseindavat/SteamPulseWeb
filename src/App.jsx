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
import { useGameData } from "./hooks/useGameData";
import { useAppSettings } from "./hooks/useAppSettings";
import { useAppInteractions } from "./hooks/useAppInteractions";
import { useCalculator } from "./hooks/useCalculator";

import { GAME_SECTION_SLUGS, getGamesSectionFromRoute, getRoutePath, useNavigation } from "./hooks/useNavigation";

export default function App() {
  const initialRoute = getRoutePath();
  const appSettings = useAppSettings();
  const {
    region, setRegion,
    steamProfile, setSteamProfile,
    steamProfileDraft, setSteamProfileDraft,
    steamApiKey, setSteamApiKey,
    steamApiKeyDraft, setSteamApiKeyDraft,
    theme, setTheme
  } = appSettings;
  const [profileRouteId, setProfileRouteId] = useState(() => {
    const match = initialRoute.match(/^\/profile\/([^/?#]+)\/?$/);
    return match ? match[1] : "";
  });
  const [currentPage, setCurrentPage] = useState(() => {
    const gameMatch = initialRoute.match(/^\/game\/(\d+)/);
    const pageMatch = initialRoute.match(/^\/(home|games|trending|market|sales|calculator|cart|settings|profile)(?:\/[^/?#]+)?\/?$/);
    return gameMatch ? "game" : (pageMatch?.[1] === "trending" ? "games" : (pageMatch?.[1] || "home"));
  });
  const [gamesSection, setGamesSection] = useState(() => getGamesSectionFromRoute(initialRoute));
  const [query, setQuery] = useState("");
  const [appid, setAppid] = useState("");
  const [inputId, setInputId] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
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
    game, setGame, gameBackground, setGameBackground,
    loading, setLoading, loadingMoreDlc, error, setError,
    regionalPriceInput, setRegionalPriceInput,
    selectedEditionName, setSelectedEditionName,
    purchaseTab, setPurchaseTab,
    loadGame: loadGameData, loadMoreDlc, invalidateGameRequest
  } = useGameData({
    region, appid, setAppid, setCurrentPage,
    setInputId, setQuery, setActiveTab
  });
  const loadGame = loadGameData;
  const {
    results, setResults, searchOpen, setSearchOpen, searching,
    searchGames, onSearchChange, chooseGame
  } = useGameSearch({ region, loadGame, setQuery, setInputId, setError });

  const { calculatorRef, searchRef, headerSearchRef } = useAppInteractions({ setSearchOpen });

  const { navigateTo, navigateToGamesSection } = useNavigation({
    appid,
    currentPage,
    setCurrentPage,
    setGamesSection,
    setProfileRouteId,
    personalSteamProfileData,
    invalidateGameRequest,
    setGame,
    setGameBackground,
    setLoading,
    setError,
    setSearchOpen,
    loadGame,
    region,
    game,
    loading
  });



  useEffect(() => {
    const pageTitles = { home: "Home", games: ({ freeGames: "Free Games", topSellers: "Top Sellers", upcoming: "Coming Soon", newReleases: "New Releases", preorders: "Preorders" })[gamesSection] || "Games", market: "Market", sales: "Sales", calculator: "Key Calculator", cart: "Shopping Cart", settings: "Settings", profile: "Profile" };
    const title = currentPage === "game" && game?.name ? game.name : (pageTitles[currentPage] || "Home");
    document.title = `${title} | SteamPulse`;
  }, [currentPage, gamesSection, game?.name]);

  useEffect(() => {
    if (game) loadGame(appid, region);
  }, [region]);

  function saveSettings() {
    appSettings.saveSettings({ setPersonalSteamProfileData, resetOwnership });
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
  const liveKeyPriceToman = Number(shopData?.Key);
  const {
    conversionMode, setConversionMode,
    conversionAmount, setConversionAmount,
    keyCount, conversionResult, conversionResultFormatted,
    conversionResultLabel, totalToman
  } = useCalculator({
    regionalPriceInput,
    regionalKeyPriceForCalculation,
    liveKeyPriceToman,
    selectedRegion
  });
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
          loading={loading}
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
          freeGames={freeGames}
          freeGamesLoading={freeGamesLoading}
          setFreeGamesLoading={setFreeGamesLoading}
          freeGamesError={freeGamesError}
          setFreeGamesError={setFreeGamesError}
          setFreeGames={setFreeGames}
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
