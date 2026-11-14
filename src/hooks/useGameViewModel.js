import { REGIONS } from "../config/regions";
import { money } from "../utils/formatters";

export function useGameViewModel({
	game,
	region,
	steamAccountConnected,
	steamWishlist,
	steamOwnedApps,
	steamOwnedPackages,
	regionalPriceInput,
	regionalKeyPrice,
	shopData,
}) {
	const gamePackageIds = [
		...new Set(
			(
				game?.package_ids ||
				game?.editions?.map((edition) => edition.packageId) ||
				[]
			)
				.map(Number)
				.filter((id) => Number.isSafeInteger(id) && id > 0),
		),
	];
	const allGameEditions = game?.editions || [];
	const gameEditions = allGameEditions;
	const gameBundles = game?.bundles || [];
	const hasEditions = gameEditions.length > 0;
	const hasBundles = gameBundles.length > 0;

	const missingPackages = gamePackageIds
		.filter(
			(packageId) =>
				!allGameEditions.some(
					(edition) => Number(edition.packageId) === packageId,
				),
		)
		.map((packageId) => ({
			packageId,
			name: `Steam package ${packageId}`,
			description: "Owned package detected in your Steam account.",
			url: `https://store.steampowered.com/sub/${packageId}/`,
		}));

	const visibleDlc = game?.dlc || [];
	// Count ownership against every DLC AppID, not only the currently loaded cards.
	const allDlcIds = [
		...new Set(
			(game?.dlc_ids || visibleDlc.map((item) => item.appid))
				.map(Number)
				.filter((id) => Number.isSafeInteger(id) && id > 0),
		),
	];
	const ownedDlcCount = steamAccountConnected
		? allDlcIds.filter(
				(id) => steamOwnedApps.has(id) || steamOwnedPackages.has(id),
			).length
		: 0;
	const totalDlcCount = Math.max(
		Number(game?.dlc_total) || 0,
		visibleDlc.length,
	);
	const dlcSectionCount =
		ownedDlcCount > 0
			? `${totalDlcCount} DLCs · ${ownedDlcCount} owned`
			: `${totalDlcCount} DLCs`;

	const gameIsWishlisted = Boolean(
		game && steamAccountConnected && steamWishlist.has(Number(game.appid)),
	);
	const gameIsOwned = Boolean(
		game &&
		steamAccountConnected &&
		(steamOwnedApps.has(Number(game.appid)) ||
			gamePackageIds.some((packageId) => steamOwnedPackages.has(packageId))),
	);

	const hero =
		game?.library_hero || game?.header_image_2x || game?.header_image;
	const price = money(game?.price_overview);
	const hasStorePrice = Boolean(
		game?.price_overview &&
		(game.price_overview.final != null || game.price_overview.final_formatted),
	);

	const hasBundlePrice = gameBundles.some(
		(bundle) => bundle.priceValue != null,
	);

	const hasPurchasePrice = hasStorePrice || hasBundlePrice;

	const selectedRegion =
		REGIONS.find((item) => item.code === region) || REGIONS[0];
	const numericRegionalPrice = Number(regionalPriceInput);
	const regionalKeyPriceValue = Number(regionalKeyPrice?.netPrice);
	const regionalKeyPriceForCalculation =
		regionalKeyPrice?.region === selectedRegion.code &&
		Number.isFinite(regionalKeyPriceValue) &&
		regionalKeyPriceValue > 0
			? regionalKeyPriceValue
			: 0;
	const liveKeyPriceToman = Number(shopData?.Key);

	const systemNames = Object.entries(game?.platforms || {})
		.filter(([, supported]) => supported)
		.map(([name]) => name);
	const tabNames = [
		"overview",
		"screenshots",
		"videos",
		"requirements",
		"steam news",
		"external news",
	];

	return {
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
		hasPurchasePrice,
		hasStorePrice,
		selectedRegion,
		numericRegionalPrice,
		regionalKeyPriceForCalculation,
		liveKeyPriceToman,
		systemNames,
		tabNames,
	};
}
