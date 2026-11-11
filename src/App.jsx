import { useEffect, useState } from "react";
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
import { useGameViewModel } from "./hooks/useGameViewModel";
import { useCartSummary } from "./hooks/useCartSummary";

import {
	getGamesSectionFromRoute,
	getRoutePath,
	useNavigation,
} from "./hooks/useNavigation";

export default function App() {
	const initialRoute = getRoutePath();
	const appSettings = useAppSettings();
	const {
		region,
		setRegion,
		steamProfile,
		steamProfileDraft,
		setSteamProfileDraft,
		steamApiKey,
		steamApiKeyDraft,
		setSteamApiKeyDraft,
		theme,
		setTheme,
	} = appSettings;
	const [profileRouteId, setProfileRouteId] = useState(() => {
		const match = initialRoute.match(/^\/profile\/([^/?#]+)\/?$/);
		return match ? match[1] : "";
	});
	const [currentPage, setCurrentPage] = useState(() => {
		const gameMatch = initialRoute.match(/^\/game\/(\d+)/);
		const pageMatch = initialRoute.match(
			/^\/(home|games|trending|market|sales|calculator|cart|settings|profile)(?:\/[^/?#]+)?\/?$/,
		);
		return gameMatch
			? "game"
			: pageMatch?.[1] === "trending"
				? "games"
				: pageMatch?.[1] || "home";
	});
	const [gamesSection, setGamesSection] = useState(() =>
		getGamesSectionFromRoute(initialRoute),
	);
	const [query, setQuery] = useState("");
	const [appid, setAppid] = useState("");
	const [inputId, setInputId] = useState("");
	const [activeTab, setActiveTab] = useState("overview");
	const {
		steamAccountSnapshot,
		steamAccountData,
		steamAccountConnected,
		steamWishlist,
		steamOwnedApps,
		steamOwnedPackages,
		steamCartApps,
		steamCartDetails,
		steamCartDetailsLoading,
		steamCartDetailsError,
	} = useSteamAccount(region);
	const {
		discovery,
		discoveryLoading,
		discoveryError,
		topSellersLoading,
		storeTakeover,
		setDiscoveryLoading,
		setDiscoveryError,
		setDiscovery,
		freeGames,
		freeGamesLoading,
		setFreeGamesLoading,
		freeGamesError,
		setFreeGamesError,
		setFreeGames,
	} = useDiscoveryData(region);
	const {
		steamProfileData,
		personalSteamProfileData,
		setPersonalSteamProfileData,
		steamProfileLoading,
		steamProfileError,
		loadSteamProfile,
		isOwnSteamProfile,
	} = useSteamProfile({
		currentPage,
		profileRouteId,
		setProfileRouteId,
		steamProfile,
		steamApiKey,
	});
	const {
		shopData,
		shopDataLoading,
		shopDataError,
		shopDataUpdatedAt,
		regionalKeyPrice,
		regionalMarketData,
		regionalMarketLoading,
		regionalMarketError,
		regionalMarketUpdatedAt,
		refreshShopData,
	} = useMarketData(region, currentPage);

	const {
		game,
		setGame,
		gameBackground,
		setGameBackground,
		loading,
		setLoading,
		loadingMoreDlc,
		error,
		setError,
		regionalPriceInput,
		setRegionalPriceInput,
		selectedEditionName,
		setSelectedEditionName,
		purchaseTab,
		setPurchaseTab,
		loadGame: loadGameData,
		loadMoreDlc,
		invalidateGameRequest,
	} = useGameData({
		region,
		appid,
		setAppid,
		setCurrentPage,
		setInputId,
		setQuery,
		setActiveTab,
	});
	const loadGame = loadGameData;
	const {
		results,
		setResults,
		searchOpen,
		setSearchOpen,
		searching,
		searchGames,
		submitSearch,
		onSearchChange,
		chooseGame,
	} = useGameSearch({ region, loadGame, setQuery, setInputId, setError });

	const { calculatorRef, searchRef, headerSearchRef } = useAppInteractions({
		setSearchOpen,
	});

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
		loading,
	});

	useEffect(() => {
		const pageTitles = {
			home: "Home",
			games:
				{
					freeGames: "Free Games",
					topSellers: "Top Sellers",
					upcoming: "Coming Soon",
					newReleases: "New Releases",
					preorders: "Preorders",
				}[gamesSection] || "Games",
			market: "Market",
			sales: "Sales",
			calculator: "Key Calculator",
			cart: "Shopping Cart",
			settings: "Settings",
			profile: "Profile",
		};
		const title =
			currentPage === "game" && game?.name
				? game.name
				: pageTitles[currentPage] || "Home";
		document.title = `${title} | SteamPulse`;
	}, [currentPage, gamesSection, game?.name]);

	useEffect(() => {
		if (game) loadGame(appid, region);
	}, [region]);

	function saveSettings() {
		appSettings.saveSettings({ setPersonalSteamProfileData, resetOwnership });
	}

	const { ownership, ownershipLoading, ownershipError, resetOwnership } =
		useGameOwnership({
			game,
			currentPage,
			steamProfile,
			steamApiKey,
		});

	const gameViewModel = useGameViewModel({
		game,
		region,
		steamAccountConnected,
		steamWishlist,
		steamOwnedApps,
		steamOwnedPackages,
		regionalPriceInput,
		regionalKeyPrice,
		shopData,
	});
	const {
		gamePackageIds,
		gameEditions,
		gameBundles,
		hasEditions,
		hasBundles,
		missingPackages,
		visibleDlc,
		dlcSectionCount,
		gameIsWishlisted,
		gameIsOwned,
		hero,
		price,
		hasStorePrice,
		selectedRegion,
		numericRegionalPrice,
		regionalKeyPriceForCalculation,
		liveKeyPriceToman,
		systemNames,
		tabNames,
	} = gameViewModel;
	const {
		conversionMode,
		setConversionMode,
		conversionAmount,
		setConversionAmount,
		keyCount,
		conversionResult,
		conversionResultFormatted,
		conversionResultLabel,
		totalToman,
	} = useCalculator({
		regionalPriceInput,
		regionalKeyPriceForCalculation,
		liveKeyPriceToman,
		selectedRegion,
	});
	const cartSummary = useCartSummary({
		steamCartDetails,
		selectedRegion,
		regionalKeyPriceForCalculation,
	});
	const {
		uniqueCartDetails,
		cartCurrency,
		cartTotalFormatted,
		cartOriginalTotalFormatted,
		cartSavingsMinor,
		cartSavingsFormatted,
		cartKeyCount,
	} = cartSummary;

	return (
		<div
			className={`app-shell${gameBackground ? " has-game-background" : ""}`}
			data-theme={theme}>
			{gameBackground && (
				<div
					className="game-background-blur"
					style={{ backgroundImage: `url("${gameBackground}")` }}
					aria-hidden="true"
				/>
			)}
			<div className="ambient ambient-one" />
			<div className="ambient ambient-two" />
			<AppHeader
				currentPage={currentPage}
				navigateTo={navigateTo}
				steamCartApps={steamCartApps}
				headerSearchRef={headerSearchRef}
				theme={theme}
				setTheme={setTheme}
				personalSteamProfileData={personalSteamProfileData}
			/>

			<main className="main-content">
				{currentPage === "profile" && (
					<ProfilePage
						steamProfileData={steamProfileData}
						steamProfileLoading={steamProfileLoading}
						steamProfileError={steamProfileError}
						steamAccountData={steamAccountData}
						steamWishlist={steamWishlist}
						isOwnSteamProfile={isOwnSteamProfile}
						navigateTo={navigateTo}
						loadSteamProfile={loadSteamProfile}
					/>
				)}

				{currentPage === "settings" && (
					<SettingsPage
						region={region}
						setRegion={setRegion}
						steamProfileDraft={steamProfileDraft}
						setSteamProfileDraft={setSteamProfileDraft}
						saveSettings={saveSettings}
						steamProfile={steamProfile}
						steamApiKeyDraft={steamApiKeyDraft}
						setSteamApiKeyDraft={setSteamApiKeyDraft}
					/>
				)}

				{currentPage === "calculator" && (
					<CalculatorPage
						region={region}
						setRegion={setRegion}
						conversionMode={conversionMode}
						setConversionMode={setConversionMode}
						conversionAmount={conversionAmount}
						setConversionAmount={setConversionAmount}
						selectedRegion={selectedRegion}
						conversionResult={conversionResult}
						conversionResultFormatted={conversionResultFormatted}
						conversionResultLabel={conversionResultLabel}
						regionalKeyPrice={regionalKeyPrice}
						regionalKeyPriceForCalculation={regionalKeyPriceForCalculation}
						liveKeyPriceToman={liveKeyPriceToman}
						shopDataError={shopDataError}
					/>
				)}

				{currentPage === "cart" && (
					<CartPage
						steamCartApps={steamCartApps}
						steamAccountConnected={steamAccountConnected}
						steamCartDetailsError={steamCartDetailsError}
						steamCartDetailsLoading={steamCartDetailsLoading}
						uniqueCartDetails={uniqueCartDetails}
						cartTotalFormatted={cartTotalFormatted}
						cartOriginalTotalFormatted={cartOriginalTotalFormatted}
						cartSavingsMinor={cartSavingsMinor}
						cartSavingsFormatted={cartSavingsFormatted}
						cartKeyCount={cartKeyCount}
						region={region}
						regionalKeyPriceForCalculation={regionalKeyPriceForCalculation}
						cartCurrency={cartCurrency}
					/>
				)}

				{currentPage === "sales" && <SalesPage />}

				{currentPage === "market" && (
					<MarketPage
						shopDataError={shopDataError}
						shopDataLoading={shopDataLoading}
						regionalMarketError={regionalMarketError}
						regionalMarketLoading={regionalMarketLoading}
						regionalMarketData={regionalMarketData}
						regionalMarketUpdatedAt={regionalMarketUpdatedAt}
						shopData={shopData}
						shopDataUpdatedAt={shopDataUpdatedAt}
						region={region}
						onRefresh={refreshShopData}
					/>
				)}

				{currentPage === "home" && (
					<HomePage
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
						submitSearch={submitSearch}
						inputId={inputId}
						setInputId={setInputId}
						discovery={discovery}
						discoveryLoading={discoveryLoading}
						discoveryError={discoveryError}
						topSellersLoading={topSellersLoading}
						storeTakeover={storeTakeover}
						region={region}
						setRegion={setRegion}
						loading={loading}
					/>
				)}
				{currentPage === "games" && (
					<TrendingPage
						discovery={discovery}
						discoveryLoading={discoveryLoading}
						discoveryError={discoveryError}
						activeSection={gamesSection}
						onNavigateSection={navigateToGamesSection}
						setDiscoveryLoading={setDiscoveryLoading}
						setDiscoveryError={setDiscoveryError}
						setDiscovery={setDiscovery}
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
					/>
				)}

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
