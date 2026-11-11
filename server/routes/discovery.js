import {
	fetchSteamBundles,
	fetchSteamPreorders,
	fetchSteamTakeover,
	fetchSteamTopSellers,
} from "../services/discoverySteam.js";

import {
	DISCOVERY_CACHE_TTL,
	registerBackgroundRefresh,
	refreshInBackground,
	staleCached,
} from "../utils/cache.js";

export function registerDiscoveryRoutes(
	app,
	{ fetchJson, fetchJsonWithOptions, cached, saveCache, coalesce, mapWithConcurrency },
) {
	const registerRefresh = (key, path, cc) => {
		registerBackgroundRefresh(key, async () => {
			const port = Number(process.env.PORT) || 3001;
			const response = await fetch(
				`http://127.0.0.1:${port}${path}?cc=${encodeURIComponent(cc)}&refresh=1`,
				{ signal: AbortSignal.timeout(120000) },
			);
			if (!response.ok) throw new Error(`Refresh endpoint returned ${response.status}`);
			await response.arrayBuffer();
		}, DISCOVERY_CACHE_TTL);
	};
	app.get("/api/search", async (req, res) => {
		const term = String(req.query.term || "").trim();
		const cc = String(req.query.cc || "US")
			.slice(0, 2)
			.toUpperCase();
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
					price: item.price || null,
				}))
				.filter((item) => Number.isFinite(item.id) && item.name);

			res.json(saveCache(key, { items }, DISCOVERY_CACHE_TTL));
		} catch (error) {
			console.error("Steam search failed:", error);
			res.status(502).json({
				error: "Steam search is temporarily unavailable.",
				detail: error.message,
			});
		}
	});

	app.get("/api/store-takeover", async (req, res) => {
		const cc = String(req.query.cc || "US")
			.slice(0, 2)
			.toUpperCase();
		const key = "store-takeover:v1:" + cc;
		registerRefresh(key, "/api/store-takeover", cc);
		if (req.query.refresh !== "1") {
			const hit = cached(key);
			if (hit) return res.json(hit);
			const stale = staleCached(key);
			if (stale) {
				res.json(stale);
				refreshInBackground(key);
				return;
			}
		}
		try {
			const takeover = await fetchSteamTakeover(cc);
			res.json(saveCache(key, { takeover }, DISCOVERY_CACHE_TTL));
		} catch (error) {
			console.warn("Could not load Steam Store Takeover:", error.message);
			res
				.status(502)
				.json({
					takeover: null,
					error: "Steam Store Takeover is temporarily unavailable.",
				});
		}
	});

	app.get("/api/top-sellers", async (req, res) => {
		const cc = String(req.query.cc || "US")
			.slice(0, 2)
			.toUpperCase();
		const key = `top-sellers:v1:${cc}`;
		registerRefresh(key, "/api/top-sellers", cc);
		if (req.query.refresh !== "1") {
			const hit = cached(key);
			if (hit) return res.json(hit);
			const stale = staleCached(key);
			if (stale) {
				res.json(stale);
				refreshInBackground(key);
				return;
			}
		}

		try {
			const [fullList, featuredData] = await Promise.all([
				coalesce(`steam-top-sellers:v1:${cc}`, () => fetchSteamTopSellers(cc)).catch((error) => {
					console.warn(
						"Could not load Steam Top Sellers search:",
						error.message,
					);
					return [];
				}),
				fetchJson(
					new URL(
						`https://store.steampowered.com/api/featuredcategories/?cc=${cc}&l=english`,
					),
				).catch((error) => {
					console.warn(
						"Could not load featured Top Sellers fallback:",
						error.message,
					);
					return null;
				}),
			]);

			const featuredItems = (featuredData?.top_sellers?.items || [])
				.filter((item) => Number(item.id) > 0 && item.name)
				.map((item) => ({
					id: Number(item.id),
					name: item.name,
					type: "game",
					image:
						item.large_capsule_image ||
						item.header_image ||
						item.small_capsule_image ||
						"",
					priceValue:
						item.final_price != null ? Number(item.final_price) / 100 : null,
					price: item.final_formatted || "",
					originalPrice:
						item.original_price != null && item.currency
							? new Intl.NumberFormat("en-US", {
									style: "currency",
									currency: item.currency,
								}).format(Number(item.original_price) / 100)
							: "",
					discountPercent: Number(item.discount_percent) || 0,
					badge: "TOP SELLER",
				}));

			const unique = new Map();
			for (const item of [...fullList, ...featuredItems]) {
				if (!item?.id || !item.name || unique.has(Number(item.id))) continue;
				const hasPaidPrice =
					item.priceValue != null
						? Number(item.priceValue) > 0
						: Boolean(String(item.price || "").trim()) &&
							!/\bfree(?:\s+to\s+play)?\b|price unavailable|not available/i.test(
								String(item.price),
							);
				if (hasPaidPrice)
					unique.set(Number(item.id), { ...item, badge: "TOP SELLER" });
			}

			const items = [...unique.values()].slice(0, 50);
			if (!items.length)
				throw new Error("Steam did not return any priced Top Sellers.");
			res.json(saveCache(key, { items }));
		} catch (error) {
			console.error("Steam Top Sellers request failed:", error);
			res
				.status(502)
				.json({
					error: "Steam Top Sellers are temporarily unavailable.",
					detail: error.message,
				});
		}
	});

	app.get("/api/discover", async (req, res) => {
		const cc = String(req.query.cc || "US")
			.slice(0, 2)
			.toUpperCase();
		const key = `discover:v26:${cc}`;
		registerRefresh(key, "/api/discover", cc);
		if (req.query.refresh !== "1") {
			const hit = cached(key);
			if (hit) return res.json(hit);
			const stale = staleCached(key);
			if (stale) {
				res.json(stale);
				refreshInBackground(key);
				return;
			}
		}

		try {
			const url = new URL(
				"https://store.steampowered.com/api/featuredcategories/",
			);
			url.searchParams.set("cc", cc);
			url.searchParams.set("l", "english");
			const data = await fetchJson(url);
			// Steam's featured-categories feed can contain hardware and other non-game products.
			// Exclude known Steam/Valve hardware by name as a lightweight fallback when appdetails
			// is rate-limited, so hardware listings never leak into game discovery.
			const nonGameHardwareName =
				/\\b(?:steam\\s*(?:deck|frame|controller|machine|link)|valve\\s*index|index\\s*(?:vr|controllers?))\\b/i;
			const normalize = async (items, badge) => {
				const candidates = (items || []).filter(
					(item) =>
						Number(item.id) > 0 &&
						item.name &&
						!nonGameHardwareName.test(String(item.name)),
				);
				const checked = await mapWithConcurrency(
					candidates,
					4,
					async (item) => {
						const type = String(item.type || "").toLowerCase();
						if (type && type !== "game") return null;
						if (type === "game") return item;
						const detailUrl = new URL(
							"https://store.steampowered.com/api/appdetails",
						);
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
								return String(envelope.data?.type || "").toLowerCase() ===
									"game"
									? item
									: null;
							}
							return null;
						} catch (error) {
							console.warn(
								`Steam appdetails check failed for discovery app ${item.id}:`,
								error.message,
							);
							return item;
						}
					},
				);
				return checked
					.filter((entry) => entry.status === "fulfilled" && entry.value)
					.map(({ value: item }) => ({
						id: Number(item.id),
						name: item.name,
						type: "game",
						image:
							item.large_capsule_image ||
							item.header_image ||
							item.small_capsule_image ||
							"",
						priceValue:
							item.final_price != null ? Number(item.final_price) / 100 : null,
						price:
							item.final_formatted ||
							(item.final_price != null
								? new Intl.NumberFormat("en-US", {
										style: "currency",
										currency: item.currency || "USD",
									}).format(Number(item.final_price) / 100)
								: ""),
						releaseDate: item.release_date?.date || item.release_date || "",
						subtitle: item.discount_percent
							? `${item.discount_percent}% off`
							: "",
						badge,
					}));
			};

			let preordersError = "";
			const [
				newReleases,
				upcoming,
				featuredTopSellers,
				fullTopSellers,
				preordersFromSteam,
			] = await Promise.all([
				normalize(data?.new_releases?.items, "NEW"),
				normalize(data?.coming_soon?.items, "UPCOMING"),
				normalize(data?.top_sellers?.items, "TOP SELLER"),
				coalesce(`steam-top-sellers:v1:${cc}`, () => fetchSteamTopSellers(cc)).catch((error) => {
					console.warn(
						"Could not load the full Steam Top Sellers list:",
						error.message,
					);
					return [];
				}),
				fetchSteamPreorders(cc).catch((error) => {
					preordersError = error.message || String(error);
					console.error(
						"Could not load Steam Popular Upcoming page:",
						preordersError,
					);
					return [];
				}),
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
				if (
					item.priceValue != null &&
					Number.isFinite(Number(item.priceValue))
				) {
					return Number(item.priceValue) > 0;
				}
				const price = String(item.price || "").trim();
				if (
					!price ||
					/\bfree(?:\s+to\s+play)?\b|price unavailable|not available/i.test(
						price,
					)
				)
					return false;
				const match = price.match(
					/(?:[$€£₴]|USD|EUR|GBP|UAH|RUB|TRY|PLN|BRL|INR)\s*([\d.,]+)|([\d.,]+)\s*(?:[$€£₴]|USD|EUR|GBP|UAH|RUB|TRY|PLN|BRL|INR)/i,
				);
				return Boolean(
					match && Number((match[1] || match[2]).replace(/[.,]/g, "")) > 0,
				);
			};
			// Top Sellers must contain purchasable games only; featured-category
			// entries can otherwise leak in with a zero or missing price.
			const topSellers = [...topSellerMap.values()]
				.filter(hasPaidPrice)
				.slice(0, 50);
			// Steam's popularcomingsoon search filter supplies the preorder/upcoming results.
			const preorders = preordersFromSteam;
			const result = {
				newReleases,
				upcoming,
				preorders,
				preordersError,
				topSellers,
			};
			if (
				!result.newReleases.length &&
				!result.upcoming.length &&
				!result.topSellers.length
			) {
				return res
					.status(502)
					.json({
						error:
							"Steam returned no discovery categories. Please try again shortly.",
					});
			}
			res.json(saveCache(key, result, DISCOVERY_CACHE_TTL));
		} catch (error) {
			console.error("Steam discovery failed:", error);
			res
				.status(502)
				.json({
					error: "Steam game discovery is temporarily unavailable.",
					detail: error.message,
				});
		}
	});

	return {
		fetchSteamBundles: (appid, cc) =>
			fetchSteamBundles(appid, cc, fetchJsonWithOptions),
	};
}
