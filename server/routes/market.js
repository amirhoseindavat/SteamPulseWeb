export function registerMarketRoutes(
	app,
	{ fetchJson, mapWithConcurrency, previousRegionalSellPrices },
) {
	const TF2_MARKET_REGIONS = [
		{
			code: "US",
			label: "United States",
			flag: "🇺🇸",
			country: "US",
			currency: 1,
			currencyCode: "USD",
		},
		{
			code: "GB",
			label: "United Kingdom",
			flag: "🇬🇧",
			country: "GB",
			currency: 2,
			currencyCode: "GBP",
		},
		{
			code: "EU",
			label: "Europe",
			flag: "🇪🇺",
			country: "DE",
			currency: 3,
			currencyCode: "EUR",
		},
		{
			code: "AR",
			label: "Argentina",
			flag: "🇦🇷",
			country: "AR",
			currency: 1,
			currencyCode: "USD",
		},
		{
			code: "TR",
			label: "Türkiye",
			flag: "🇹🇷",
			country: "TR",
			currency: 1,
			currencyCode: "USD",
		},
		{
			code: "UA",
			label: "Ukraine",
			flag: "🇺🇦",
			country: "UA",
			currency: 18,
			currencyCode: "UAH",
		},
		{
			code: "RU",
			label: "Russia",
			flag: "🇷🇺",
			country: "RU",
			currency: 5,
			currencyCode: "RUB",
		},
		{
			code: "IN",
			label: "India",
			flag: "🇮🇳",
			country: "IN",
			currency: 24,
			currencyCode: "INR",
		},
		{
			code: "BR",
			label: "Brazil",
			flag: "🇧🇷",
			country: "BR",
			currency: 7,
			currencyCode: "BRL",
		},
		{
			code: "KZ",
			label: "Kazakhstan",
			flag: "🇰🇿",
			country: "KZ",
			currency: 37,
			currencyCode: "KZT",
		},
		{
			code: "CN",
			label: "China",
			flag: "🇨🇳",
			country: "CN",
			currency: 23,
			currencyCode: "CNY",
		},
		{
			code: "JP",
			label: "Japan",
			flag: "🇯🇵",
			country: "JP",
			currency: 8,
			currencyCode: "JPY",
		},
	];

	app.get("/api/market-regions", async (_req, res) => {
		try {
			// This project intentionally uses item_nameid=1 for the TF2 key, as in the previously working setup.
			const itemNameId = "1";
			const results = await mapWithConcurrency(
				TF2_MARKET_REGIONS,
				2,
				async (region) => {
					const url = new URL(
						"https://steamcommunity.com/market/itemordershistogram",
					);
					// Country is ISO alpha-2 (e.g. US); currency is Steam’s numeric wallet currency ID (e.g. 1 for USD).
					url.searchParams.set("country", region.country);
					url.searchParams.set("language", "english");
					url.searchParams.set("currency", String(region.currency));
					url.searchParams.set("item_nameid", itemNameId);
					url.searchParams.set("two_factor", "0");
					url.searchParams.set("norender", "1");

					const listingUrl =
						"https://steamcommunity.com/market/listings/440/Mann-Co.-Supply-Crate-Key/";
					const data = await fetchJson(url, {
						headers: {
							"User-Agent":
								"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
							Accept: "application/json, text/plain, */*",
							Referer: listingUrl,
							Origin: "https://steamcommunity.com",
						},
					});

					if (Number(data?.success) !== 1) {
						throw new Error(
							`Steam histogram returned success=${String(data?.success ?? "missing")} for ${region.code} (country=${region.country}, currency=${region.currency})`,
						);
					}

					const lowest = Number(data.lowest_sell_order);
					const highestBuy = Number(data.highest_buy_order);
					const graphLowest =
						Array.isArray(data.sell_order_graph) && data.sell_order_graph.length
							? Number(data.sell_order_graph[0][0])
							: NaN;
					const graphHighestBuy =
						Array.isArray(data.buy_order_graph) && data.buy_order_graph.length
							? Number(data.buy_order_graph[0][0])
							: NaN;
					const price =
						Number.isFinite(lowest) && lowest > 0
							? lowest / 100
							: Number.isFinite(graphLowest) && graphLowest > 0
								? graphLowest
								: null;
					const buyPrice =
						Number.isFinite(highestBuy) && highestBuy > 0
							? highestBuy / 100
							: Number.isFinite(graphHighestBuy) && graphHighestBuy > 0
								? graphHighestBuy
								: null;
					const net = price == null ? null : price * 0.87;
					const previous = previousRegionalSellPrices.get(region.code);
					const change =
						price == null || previous == null ? null : price - previous;
					if (price != null) previousRegionalSellPrices.set(region.code, price);

					const prefix = String(data.price_prefix || "");
					const suffix = String(data.price_suffix || "");
					const fmt = (value) =>
						value == null
							? null
							: `${prefix}${new Intl.NumberFormat("en-US", {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
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
						buyOrderCount: data.buy_order_count ?? null,
					};
				},
			);

			const regions = results
				.filter((item) => item.status === "fulfilled")
				.map((item) => item.value);
			const failures = results
				.map((item, index) =>
					item.status === "rejected"
						? {
								region: TF2_MARKET_REGIONS[index]?.code,
								reason: item.reason?.message || "Unknown Steam error",
							}
						: null,
				)
				.filter(Boolean);

			if (!regions.length) {
				console.error("Steam histogram failed for all regions:", failures);
				throw new Error(
					"Steam returned no valid histogram data. " +
						failures.map((item) => `${item.region}: ${item.reason}`).join("; "),
				);
			}

			res.set("Cache-Control", "no-store");
			res.json({
				item: "Mann Co. Supply Crate Key",
				itemNameId,
				source: "Steam Community Market itemordershistogram",
				fetchedAt: new Date().toISOString(),
				regions,
				failedRegions: failures,
			});
		} catch (error) {
			console.error("Steam regional market request failed:", error);
			res.status(502).json({
				error: "Could not load TF2 Key prices from Steam Community Market.",
				detail: error.message,
			});
		}
	});

	const TF2_KEY_PRICE_CURRENCIES = {
		US: 1, // USD
		GB: 2, // GBP
		DE: 3, // EUR
		TR: 1, // USD (Steam pricing used by this calculator)
		AR: 1, // USD (Steam pricing used by this calculator)
		PL: 6, // PLN
		UA: 18, // UAH
		IN: 24, // INR
		BR: 7, // BRL
	};

	// Keep the last valid regional price even after its fresh-cache window expires.
	// This lets the calculator continue working while Steam is rate-limiting requests.
	const REGIONAL_KEY_PRICE_CACHE_TTL = 60 * 60 * 1000;
	const REGIONAL_KEY_PRICE_RETRY_DELAY = 60 * 1000;
	const regionalKeyPriceCache = new Map();
	const regionalKeyPriceInFlight = new Map();
	const regionalKeyPriceRetryAfter = new Map();

	app.get("/api/key-price", async (req, res) => {
		const region = String(req.query.region || "US").toUpperCase();
		const currency = TF2_KEY_PRICE_CURRENCIES[region];
		if (!currency)
			return res.status(400).json({ error: "Unsupported Steam region." });

		const now = Date.now();
		const cachedPrice = regionalKeyPriceCache.get(region);

		// Serve a fresh cached value without contacting Steam.
		if (
			cachedPrice &&
			now - cachedPrice.cachedAt < REGIONAL_KEY_PRICE_CACHE_TTL
		) {
			return res.json({ ...cachedPrice.value, cached: true, stale: false });
		}

		// If Steam recently failed, avoid hammering it. Use stale data if available.
		const retryAt = regionalKeyPriceRetryAfter.get(region) || 0;
		if (now < retryAt) {
			if (cachedPrice) {
				return res.json({
					...cachedPrice.value,
					cached: true,
					stale: true,
					warning:
						"Steam is temporarily limiting requests; showing the last valid cached price.",
				});
			}
			return res.status(502).json({
				error: `Steam price is temporarily unavailable for ${region}.`,
				retryAfter: new Date(retryAt).toISOString(),
			});
		}

		// Reuse an in-progress request for the same region.
		if (regionalKeyPriceInFlight.has(region)) {
			try {
				const value = await regionalKeyPriceInFlight.get(region);
				return res.json(value);
			} catch (error) {
				if (cachedPrice) {
					return res.json({
						...cachedPrice.value,
						cached: true,
						stale: true,
						warning:
							"Steam is temporarily unavailable; showing the last valid cached price.",
					});
				}
				return res
					.status(502)
					.json({
						error:
							error.message || `Could not load Steam key price for ${region}.`,
					});
			}
		}

		const request = (async () => {
			const regionMeta = TF2_MARKET_REGIONS.find(
				(item) => item.code === region,
			) || { country: region, currency };
			const url = new URL(
				"https://steamcommunity.com/market/itemordershistogram",
			);
			url.searchParams.set("country", regionMeta.country);
			url.searchParams.set("language", "english");
			url.searchParams.set("currency", String(currency));
			url.searchParams.set("item_nameid", "1");
			url.searchParams.set("two_factor", "0");
			url.searchParams.set("norender", "1");

			const response = await fetch(url, {
				headers: {
					Accept: "application/json, text/plain, */*",
					"User-Agent": "Mozilla/5.0 SteamPulseWeb/1.0",
					Referer:
						"https://steamcommunity.com/market/listings/440/Mann-Co.-Supply-Crate-Key/",
					Origin: "https://steamcommunity.com",
				},
				signal: AbortSignal.timeout(10000),
			});
			if (!response.ok) {
				const error = new Error(
					`Steam histogram returned ${response.status} for ${region}.`,
				);
				error.status = response.status;
				throw error;
			}
			const data = await response.json();
			const rawSellOrder = Number(data?.lowest_sell_order);
			const graphSellOrder = Array.isArray(data?.sell_order_graph)
				? Number(data.sell_order_graph[0]?.[0])
				: NaN;
			const grossPrice =
				Number(data?.success) === 1 && rawSellOrder > 0
					? rawSellOrder / 100
					: Number(data?.success) === 1 && graphSellOrder > 0
						? graphSellOrder
						: NaN;
			if (!Number.isFinite(grossPrice) || grossPrice <= 0)
				throw new Error(
					`Steam did not return a valid histogram key price for ${region}.`,
				);
			const netPrice = Number((grossPrice * 0.87).toFixed(2));
			const value = {
				region,
				currency,
				lowestPrice: `${String(data.price_prefix || "")}${grossPrice.toFixed(2)}${String(data.price_suffix || "")}`,
				grossPrice,
				feeRate: 0.13,
				netPrice,
				fetchedAt: new Date().toISOString(),
				cached: false,
				stale: false,
			};
			regionalKeyPriceCache.set(region, { value, cachedAt: Date.now() });
			regionalKeyPriceRetryAfter.delete(region);
			return value;
		})();

		regionalKeyPriceInFlight.set(region, request);
		try {
			const value = await request;
			res.set("Cache-Control", "no-store");
			return res.json(value);
		} catch (error) {
			console.error(`Steam key price request failed for ${region}:`, error);
			regionalKeyPriceRetryAfter.set(
				region,
				Date.now() + REGIONAL_KEY_PRICE_RETRY_DELAY,
			);

			if (cachedPrice) {
				res.set("Cache-Control", "no-store");
				return res.json({
					...cachedPrice.value,
					cached: true,
					stale: true,
					warning:
						error.message ||
						"Steam is temporarily unavailable; showing the last valid cached price.",
				});
			}

			return res.status(502).json({
				error: error.message || `Could not load Steam key price for ${region}.`,
				retryAfter: new Date(
					Date.now() + REGIONAL_KEY_PRICE_RETRY_DELAY,
				).toISOString(),
			});
		} finally {
			regionalKeyPriceInFlight.delete(region);
		}
	});

	app.get("/api/shop-data", async (_req, res) => {
		try {
			const response = await fetch(
				"https://api.codemage.ir/Projects/SteamPulse/ShopData/",
				{
					headers: {
						Accept: "application/json",
						"User-Agent": "SteamPulseWeb/1.0",
					},
					signal: AbortSignal.timeout(10000),
				},
			);
			if (!response.ok)
				return res
					.status(502)
					.json({ error: `Shop data API returned ${response.status}.` });
			const data = await response.json();
			const keyPrice = Number(String(data?.Key ?? "").replace(/[\\s,٬]/g, ""));
			if (!data || !Number.isFinite(keyPrice) || keyPrice <= 0) {
				return res
					.status(502)
					.json({ error: "Shop data API returned an invalid Key price." });
			}

			let steamKeyPriceUsd = null;
			let steamKeyPriceUpdatedAt = null;
			const cachedUsdKey = regionalKeyPriceCache.get("US");
			if (cachedUsdKey?.value?.grossPrice > 0) {
				steamKeyPriceUsd = cachedUsdKey.value.grossPrice;
				steamKeyPriceUpdatedAt = cachedUsdKey.value.fetchedAt;
			}

			res.set("Cache-Control", "no-store");
			res.json({
				...data,
				Key: keyPrice,
				steamKeyPriceUsd,
				steamKeyPriceUpdatedAt,
			});
		} catch (error) {
			console.error("Shop data request failed:", error);
			res
				.status(502)
				.json({
					error: "Could not fetch live shop data.",
					detail: error.message,
				});
		}
	});
}
