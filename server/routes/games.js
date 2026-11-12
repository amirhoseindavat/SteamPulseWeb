function cleanEditionName(value) {
	return String(value || "")
		.replace(/<span[^>]*discount_original_price[^>]*>[\s\S]*?<\/span>/gi, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(
			/\s*[\d][\d\s.,]*(?:₴|\$|€|£|USD|EUR|GBP|UAH|RUB|TRY|PLN|BRL|INR)\s*/gi,
			" ",
		)
		.replace(/\s+/g, " ")
		.replace(/[\s–—-]+$/g, "")
		.replace(/^\s*[-–—:]+\s*|\s*[-–—:]+\s*$/g, "")
		.trim();
}

export function registerGameRoutes(
	app,
	{
		fetchJson,
		cached,
		saveCache,
		CACHE_TTL,
		mapWithConcurrency,
		fetchSteamBundles,
	},
) {
	app.get("/api/cart-details", async (req, res) => {
		const cc = String(req.query.cc || "US")
			.slice(0, 2)
			.toUpperCase();
		const appids = [
			...new Set(
				String(req.query.apps || "")
					.split(",")
					.map(Number)
					.filter((id) => Number.isSafeInteger(id) && id > 0),
			),
		].slice(0, 50);
		if (!appids.length) return res.json({ region: cc, items: [] });

		const cacheKey = `cart-details:${cc}:a=${appids.join(".")}`;
		const hit = cached(cacheKey);
		if (hit) return res.json(hit);

		try {
			const apps = await mapWithConcurrency(appids, 5, async (id) => {
				const url = new URL("https://store.steampowered.com/api/appdetails");
				url.searchParams.set("appids", String(id));
				url.searchParams.set("cc", cc);
				url.searchParams.set("l", "english");
				const envelope = (await fetchJson(url))?.[id];
				const fallbackImage = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;

				if (!envelope?.success || !envelope.data) {
					return {
						id,
						type: "app",
						name: `App ${id}`,
						image: fallbackImage,
						price: null,
						currency: null,
						url: `https://store.steampowered.com/app/${id}/`,
					};
				}

				const d = envelope.data;
				const price = d.price_overview || null;
				return {
					id,
					type: "app",
					name: d.name || `App ${id}`,
					image: d.header_image || d.capsule_image || fallbackImage,
					price: d.is_free ? 0 : (price?.final ?? null),
					initialPrice: price?.initial ?? price?.final ?? null,
					discountPercent: Number(price?.discount_percent || 0),
					formattedInitialPrice: price
						? new Intl.NumberFormat("en-US", {
								style: "currency",
								currency: price.currency || "USD",
							}).format(Number(price.initial ?? price.final ?? 0) / 100)
						: null,
					formattedPrice: d.is_free
						? "Free"
						: price?.final_formatted ||
							(price
								? new Intl.NumberFormat("en-US", {
										style: "currency",
										currency: price.currency || "USD",
									}).format(Number(price.final || 0) / 100)
								: "Price unavailable"),
					currency: price?.currency || null,
					url: `https://store.steampowered.com/app/${id}/`,
					free: Boolean(d.is_free) || Number(price?.final) === 0,
				};
			});

			const result = {
				region: cc,
				items: apps
					.filter((entry) => entry.status === "fulfilled")
					.map((entry) => entry.value),
			};
			res.json(saveCache(cacheKey, result));
		} catch (error) {
			console.error("Steam cart details failed:", error);
			res
				.status(502)
				.json({
					error: "Could not load Steam cart item details.",
					detail: error.message,
				});
		}
	});

	app.get("/api/game/:appid", async (req, res) => {
		const appid = String(req.params.appid);
		if (!/^\d+$/.test(appid)) {
			return res.status(400).json({ error: "AppID must be numeric." });
		}

		const cc = String(req.query.cc || "US")
			.slice(0, 2)
			.toUpperCase();
		const key = `game:${appid}:${cc}`;
		const hit = cached(key);
		if (hit) return res.json(hit);

		try {
			const storeUrl = new URL("https://store.steampowered.com/api/appdetails");
			storeUrl.searchParams.set("appids", appid);
			storeUrl.searchParams.set("cc", cc);
			storeUrl.searchParams.set("l", "english");

			const usStoreUrl = new URL(
				"https://store.steampowered.com/api/appdetails",
			);
			usStoreUrl.searchParams.set("appids", appid);
			usStoreUrl.searchParams.set("cc", "US");
			usStoreUrl.searchParams.set("l", "english");

			const deckReportUrl = new URL(
				"https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport",
			);
			deckReportUrl.searchParams.set("nAppID", appid);
			deckReportUrl.searchParams.set("l", "english");

			const [storeResult, playersResult, usStoreResult, deckResult] =
				await Promise.allSettled([
					fetchJson(storeUrl),
					fetchJson(
						`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`,
					),
					cc === "US" ? Promise.resolve(null) : fetchJson(usStoreUrl),
					fetchJson(deckReportUrl),
				]);

			const storeEnvelope =
				storeResult.status === "fulfilled" ? storeResult.value?.[appid] : null;

			if (storeResult.status === "rejected") {
				const reason = storeResult.reason;
				const status = reason?.status === 429 ? 503 : 502;
				console.warn(
					`Steam appdetails request failed for AppID ${appid} (region ${cc}): ${reason?.message || reason}`,
				);
				return res.status(status).json({
					error:
						reason?.status === 429
							? "Steam is rate-limiting requests. Please wait a little and try again."
							: "Steam appdetails is temporarily unavailable.",
					detail: reason?.message || "Unknown upstream error",
					...(reason?.retryAfter ? { retry_after: reason.retryAfter } : {}),
				});
			}

			if (!storeEnvelope?.success || !storeEnvelope.data) {
				console.warn(
					`Steam returned no appdetails data for AppID ${appid} (region ${cc}); success=${String(storeEnvelope?.success)}`,
				);
				return res.status(404).json({
					error: "Steam did not return details for this AppID.",
					detail:
						"Steam returned success=false or an empty data field. The AppID may be invalid, unavailable in this region, or Steam may be temporarily having issues.",
				});
			}

			const d = storeEnvelope.data;
			const usEnvelope =
				cc === "US"
					? storeEnvelope
					: usStoreResult.status === "fulfilled"
						? usStoreResult.value?.[appid]
						: null;
			const usPriceOverview = usEnvelope?.success
				? usEnvelope.data?.price_overview || null
				: null;
			const playerCount =
				playersResult.status === "fulfilled"
					? (playersResult.value?.response?.player_count ?? null)
					: null;

			const deckData =
				deckResult.status === "fulfilled" && deckResult.value?.success === 1
					? deckResult.value.results
					: null;
			const deckCategory = Number(deckData?.resolved_category || 0);
			const deckStatusByCategory = {
				0: {
					status: "unknown",
					label: "Unknown",
					summary:
						"Steam has not published a compatibility rating for this game.",
				},
				1: {
					status: "unsupported",
					label: "Unsupported",
					summary:
						"Steam reports that this game is not supported on Steam Deck.",
				},
				2: {
					status: "playable",
					label: "Playable",
					summary:
						"The game works on Steam Deck, but may require some manual configuration.",
				},
				3: {
					status: "verified",
					label: "Verified",
					summary:
						"The game meets Steam Deck compatibility requirements and should work out of the box.",
				},
			};
			const deckCriteriaNames = {
				SteamDeckVerified_TestResult_DefaultControllerConfigFullyFunctional:
					"Controller configuration works by default",
				SteamDeckVerified_TestResult_ControllerGlyphsMatchDeckDevice:
					"Controller prompts match Steam Deck",
				SteamDeckVerified_TestResult_InterfaceTextIsLegible:
					"Interface text is readable",
				SteamDeckVerified_TestResult_DefaultConfigurationIsPerformant:
					"Default graphics settings perform well",
				SteamDeckVerified_TestResult_SupportsDisplayResolution:
					"Supports Steam Deck display resolution",
				SteamDeckVerified_TestResult_SupportsExternalControllers:
					"Supports external controllers",
				SteamDeckVerified_TestResult_NoLauncher:
					"No additional launcher required",
				SteamDeckVerified_TestResult_CloudSaves: "Cloud saves supported",
				SteamDeckVerified_TestResult_CompatibleWithSteamOS:
					"Compatible with SteamOS",
			};
			const deckCriteria = (deckData?.resolved_items || []).map((item) => {
				const token = String(item.loc_token || "").replace(/^#/, "");
				const key = token.replace(/^SteamDeckVerified_TestResult_/, "");
				const name =
					deckCriteriaNames[token] ||
					key
						.replace(/([a-z])([A-Z])/g, "$1 $2")
						.replace(/_/g, " ")
						.replace(/\b\w/g, (letter) => letter.toUpperCase());
				const result =
					Number(item.display_type) === 4
						? "pass"
						: Number(item.display_type) === 5
							? "fail"
							: "info";
				return { name, result };
			});
			const steamDeck = {
				...(deckStatusByCategory[deckCategory] || deckStatusByCategory[0]),
				criteria: deckCriteria,
			};

			let hero = d.header_image || "";
			const hero2x = hero.replace(/\/header\.jpg(?=\?|$)/, "/header_2x.jpg");
			if (hero2x !== hero) hero = hero2x;
			let libraryHero = "";
			let gameLogo = "";

			const assetUrl = new URL(
				"https://api.steampowered.com/IStoreBrowseService/GetItems/v1/",
			);
			assetUrl.searchParams.set(
				"input_json",
				JSON.stringify({
					ids: [{ appid: Number(appid) }],
					context: { language: "english", country_code: cc },
					data_request: { include_assets: true },
				}),
			);

			// StoreBrowse is still used for the library background. The game logo
			// comes from SteamCMD's appinfo metadata, including its English 2x asset.
			const [assetsResult, steamCmdResult] = await Promise.allSettled([
				fetchJson(assetUrl),
				fetchJson(`https://api.steamcmd.net/v1/info/${appid}`),
			]);

			if (assetsResult.status === "fulfilled") {
				const item =
					assetsResult.value?.response?.store_items?.[0] ||
					assetsResult.value?.store_items?.[0];
				const itemAssets = item?.assets || {};
				const assetUrlFormat = String(itemAssets.asset_url_format || "");

				if (itemAssets.library_hero) {
					if (assetUrlFormat.includes("${FILENAME}")) {
						const resolved = assetUrlFormat.replace(
							"${FILENAME}",
							itemAssets.library_hero,
						);
						libraryHero = /^https?:\/\//i.test(resolved)
							? resolved
							: `https://shared.akamai.steamstatic.com/store_item_assets/${resolved.replace(/^\/+/, "")}`;
					} else {
						libraryHero = `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`;
					}
				}
			}

			if (steamCmdResult.status === "fulfilled") {
				const appInfo = steamCmdResult.value?.data?.[appid];
				const logoAsset =
					appInfo?.common?.library_assets_full?.library_logo?.image2x
						?.english;
				if (
					typeof logoAsset === "string" &&
					logoAsset.trim() &&
					!/^https?:\/\//i.test(logoAsset)
				) {
					gameLogo = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/${logoAsset.replace(/^\/+/, "")}`;
				}
			}

			const packageGroups = Array.isArray(d.package_groups)
				? d.package_groups
				: [];
			const packageIds = [
				...new Set(
					packageGroups.flatMap((group) =>
						(group.subs || [])
							.map((sub) => Number(sub.packageid || sub.id))
							.filter((id) => Number.isSafeInteger(id) && id > 0),
					),
				),
			];
			const editions = packageGroups.flatMap((group) =>
				(group.subs || []).map((sub) => ({
					packageId: Number(sub.packageid || sub.id) || null,
					name: cleanEditionName(
						group.name === "subscriptions"
							? group.title ||
									sub.option_text ||
									sub.name ||
									group.name ||
									"Steam edition"
							: sub.option_text ||
									sub.name ||
									group.title ||
									group.name ||
									"Steam edition",
					),
					description:
						group.name === "subscriptions"
							? sub.option_text || group.description || ""
							: sub.option_description || group.description || "",
					kind: group.name || group.title || "EDITION",
					priceValue:
						sub.price_in_cents_with_discount != null
							? Number(sub.price_in_cents_with_discount) / 100
							: sub.price_in_cents != null
								? Number(sub.price_in_cents) / 100
								: null,
					price:
						sub.price_in_cents_with_discount != null
							? new Intl.NumberFormat("en-US", {
									style: "currency",
									currency: d.price_overview?.currency || "USD",
								}).format(Number(sub.price_in_cents_with_discount) / 100)
							: sub.price_in_cents != null
								? new Intl.NumberFormat("en-US", {
										style: "currency",
										currency: d.price_overview?.currency || "USD",
									}).format(Number(sub.price_in_cents) / 100)
								: null,
					originalPrice:
						sub.price_in_cents != null &&
						sub.price_in_cents_with_discount != null &&
						Number(sub.price_in_cents) >
							Number(sub.price_in_cents_with_discount)
							? new Intl.NumberFormat("en-US", {
									style: "currency",
									currency: d.price_overview?.currency || "USD",
								}).format(Number(sub.price_in_cents) / 100)
							: null,
					savings: sub.percent_savings_text
						? String(sub.percent_savings_text).replace(/[^0-9]/g, "")
						: sub.price_in_cents != null &&
							  sub.price_in_cents_with_discount != null &&
							  Number(sub.price_in_cents) > 0
							? String(
									Math.round(
										(1 -
											Number(sub.price_in_cents_with_discount) /
												Number(sub.price_in_cents)) *
											100,
									),
								)
							: "",
					url:
						sub.packageid || sub.id
							? `https://store.steampowered.com/sub/${sub.packageid || sub.id}/`
							: "",
				})),
			);

			const isPrePurchase = Boolean(
				d.release_date?.coming_soon && Number(d.price_overview?.final) > 0,
			);
			const dlcIds = Array.isArray(d.dlc)
				? d.dlc.map(Number).filter(Number.isFinite)
				: [];
			const dlcIdsToFetch = dlcIds.slice(0, 24);
			const dlcResults = await mapWithConcurrency(
				dlcIdsToFetch,
				4,
				async (dlcId) => {
					const dlcUrl = new URL(
						"https://store.steampowered.com/api/appdetails",
					);
					dlcUrl.searchParams.set("appids", String(dlcId));
					dlcUrl.searchParams.set("cc", cc);
					dlcUrl.searchParams.set("l", "english");
					const response = await fetchJson(dlcUrl);
					const envelope = response?.[dlcId];
					if (!envelope?.success || !envelope.data) return null;
					const item = envelope.data;
					return {
						appid: dlcId,
						name: item.name || `DLC ${dlcId}`,
						image: item.header_image || "",
						price:
							item.price_overview?.final_formatted ||
							(item.price_overview
								? new Intl.NumberFormat("en-US", {
										style: "currency",
										currency: item.price_overview.currency || "USD",
									}).format(item.price_overview.final / 100)
								: item.is_free
									? "Free"
									: null),
						url: `https://store.steampowered.com/app/${dlcId}/`,
					};
				},
			);
			const dlc = dlcResults
				.filter((r) => r.status === "fulfilled" && r.value)
				.map((r) => r.value);
			const bundles = [];

			let parentGame = d.fullgame?.appid
				? {
						appid: Number(d.fullgame.appid),
						name: d.fullgame.name || "Base game",
						header_image: d.fullgame.header_image || "",
					}
				: null;
			// Steam's DLC metadata often omits the parent game's artwork; request the base game's appdetails as a fallback.
			if (parentGame && !parentGame.header_image) {
				try {
					const parentUrl = new URL(
						"https://store.steampowered.com/api/appdetails",
					);
					parentUrl.searchParams.set("appids", String(parentGame.appid));
					parentUrl.searchParams.set("cc", cc);
					parentUrl.searchParams.set("l", "english");
					const parentEnvelope = (await fetchJson(parentUrl))?.[
						String(parentGame.appid)
					];
					if (parentEnvelope?.success && parentEnvelope.data) {
						parentGame = {
							...parentGame,
							name: parentEnvelope.data.name || parentGame.name,
							header_image:
								parentEnvelope.data.header_image ||
								parentEnvelope.data.header_image_2x ||
								"",
						};
					}
				} catch (error) {
					console.warn(
						`Could not load base-game artwork for AppID ${parentGame.appid}: ${error.message || error}`,
					);
				}
			}

			const decodeNewsText = (value) =>
				String(value || "")
					.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
					.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
					.replace(/<\s*br\s*\/?\s*>|<\s*\/(?:p|div|li|h[1-6])\s*>/gi, " ")
					.replace(/<[^>]*>/g, " ")
					.replace(
						/\[(?:\/)?(?:img|url|b|i|u|h[1-6]|list|\*|quote|code|strike|spoiler)[^\]]*\]/gi,
						" ",
					)
					.replace(/&nbsp;|&#160;/gi, " ")
					.replace(/&amp;/gi, "&")
					.replace(/&quot;/gi, '"')
					.replace(/&#39;|&apos;/gi, "'")
					.replace(/&lt;/gi, "<")
					.replace(/&gt;/gi, ">")
					.replace(/&#x([\da-f]+);/gi, (_, hex) =>
						String.fromCodePoint(parseInt(hex, 16)),
					)
					.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
					.replace(/\s+/g, " ")
					.trim();

			const extractNewsImage = (contents) => {
				const source = String(contents || "");
				const patterns = [
					/<img\b[^>]*(?:src|data-src)\s*=\s*["']([^"']+)["']/i,
					/<img\b[^>]*(?:src|data-src)\s*=\s*([^\s>]+)/i,
					/\[img\](https?:\/\/[^\[]+)\[\/img\]/i,
					/\[img\s+src\s*=\s*["']?(https?:\/\/[^\s"'\]]+)/i,
					/https?:\/\/[^\s"'<>\]]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>\]]*)?/i,
				];
				for (const pattern of patterns) {
					const match = source.match(pattern);
					if (match) {
						const url = String(match[1] || match[0])
							.replace(/&amp;/gi, "&")
							.replace(/["'\]>]+$/, "");
						if (/^https?:\/\//i.test(url)) return url;
					}
				}
				return "";
			};

			const mapNewsItems = (items, fallbackLabel, rssImages = new Map()) =>
				(items || []).map((item) => {
					const rawContents = String(item.contents || "");
					const image =
						extractNewsImage(rawContents) ||
						rssImages.get(
							String(item.title || "")
								.trim()
								.toLowerCase(),
						) ||
						"";
					return {
						gid: item.gid,
						title: decodeNewsText(item.title || "Game update"),
						url: item.url || `https://store.steampowered.com/news/app/${appid}`,
						date: Number(item.date) || 0,
						feedlabel: decodeNewsText(item.feedlabel || fallbackLabel),
						image,
						contents: decodeNewsText(rawContents).slice(0, 420),
					};
				});

			const fetchSteamNewsRssImages = async () => {
				try {
					const rssUrl = new URL(
						`https://store.steampowered.com/feeds/news/app/${appid}/`,
					);
					rssUrl.searchParams.set("cc", cc);
					rssUrl.searchParams.set("l", "english");
					const response = await fetch(rssUrl, {
						headers: {
							"User-Agent": "Mozilla/5.0 SteamPulseWeb/1.0",
							Accept: "application/rss+xml, application/xml, text/xml",
						},
						signal: AbortSignal.timeout(8000),
					});
					if (!response.ok) return new Map();
					const xml = await response.text();
					const images = new Map();
					for (const match of xml.matchAll(
						/<item\b[^>]*>([\s\S]*?)<\/item>/gi,
					)) {
						const block = match[1];
						const title = decodeNewsText(
							block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "",
						).toLowerCase();
						const image =
							block.match(/<enclosure\b[^>]*\burl=["']([^"']+)["']/i)?.[1] ||
							block.match(
								/<media:content\b[^>]*\burl=["']([^"']+)["']/i,
							)?.[1] ||
							extractNewsImage(block);
						if (title && image && /^https?:\/\//i.test(image))
							images.set(title, image.replace(/&amp;/gi, "&"));
					}
					return images;
				} catch (error) {
					console.warn(
						`Could not load Steam news RSS images for AppID ${appid}: ${error.message}`,
					);
					return new Map();
				}
			};

			let gameNews = [];
			let externalNews = [];
			try {
				const newsUrl = new URL(
					"https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/",
				);
				newsUrl.searchParams.set("appid", String(appid));
				newsUrl.searchParams.set("count", "8");
				newsUrl.searchParams.set("feeds", "steam_community_announcements");
				// Steam returns full HTML/BBCode when maxlength=0. UINT32_MAX keeps the
				// full text while asking Steam to strip its formatting markup.
				newsUrl.searchParams.set("maxlength", "4294967295");
				newsUrl.searchParams.set("format", "json");
				const [newsData, rssImages] = await Promise.all([
					fetchJson(newsUrl),
					fetchSteamNewsRssImages(),
				]);
				gameNews = mapNewsItems(
					newsData?.appnews?.newsitems,
					"STEAM NEWS",
					rssImages,
				);
			} catch (error) {
				console.warn(
					`Could not load Steam news for AppID ${appid}: ${error.message}`,
				);
			}

			try {
				const externalUrl = new URL(
					"https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/",
				);
				externalUrl.searchParams.set("appid", String(appid));
				externalUrl.searchParams.set("count", "12");
				externalUrl.searchParams.set("maxlength", "600");
				externalUrl.searchParams.set("format", "json");
				const externalData = await fetchJson(externalUrl);
				const externalItems = (externalData?.appnews?.newsitems || []).filter(
					(item) =>
						String(item.feedname || "").toLowerCase() !==
						"steam_community_announcements",
				);
				externalNews = mapNewsItems(externalItems, "EXTERNAL NEWS");
			} catch (error) {
				console.warn(
					`Could not load external news for AppID ${appid}: ${error.message}`,
				);
			}

			const result = {
				appid: Number(appid),
				name: d.name || "Unknown game",
				type: d.type || "game",
				parent_game: parentGame,
				short_description: d.short_description || "",
				about_the_game: d.about_the_game || "",
				header_image: d.header_image || "",
				header_image_2x: hero,
				library_hero: libraryHero,
				game_logo: gameLogo,
				background: d.background || "",
				background_raw: d.background_raw || "",
				developers: d.developers || [],
				publishers: d.publishers || [],
				release_date: d.release_date?.date || "Unknown",
				coming_soon: Boolean(d.release_date?.coming_soon),
				pre_purchase: isPrePurchase,
				genres: (d.genres || []).map((g) => g.description),
				categories: (d.categories || []).map((c) => ({
					id: Number(c.id),
					description: c.description,
				})),
				platforms: d.platforms || {},
				price_overview: d.price_overview || null,
				us_price_overview: usPriceOverview,
				editions,
				package_ids: packageIds,
				bundles,
				dlc,
				// Keep every DLC AppID so ownership totals are accurate before all cards are loaded.
				dlc_ids: dlcIds,
				dlc_total: dlcIds.length,
				dlc_next_offset: dlcIdsToFetch.length,
				dlc_has_more: dlcIdsToFetch.length < dlcIds.length,
				metacritic: d.metacritic || null,
				recommendations: d.recommendations?.total ?? null,
				screenshots: (d.screenshots || [])
					.map((s) => s.path_full)
					.filter(Boolean),
				news: gameNews,
				external_news: externalNews,
				movies: (d.movies || []).map((m) => ({
					name: m.name,
					thumbnail: m.thumbnail,
					webm: m.webm?.max || m.webm?.["480"] || "",
					mp4: m.mp4?.max || m.mp4?.["480"] || "",
				})),
				website: d.website || "",
				steam_url: `https://store.steampowered.com/app/${appid}/`,
				player_count: playerCount,
				steam_deck: steamDeck,
				pc_requirements: d.pc_requirements || null,
			};

			res.json(saveCache(key, result));
		} catch (error) {
			console.error(`Failed to load Steam AppID ${appid}:`, error);
			res.status(502).json({
				error: "Could not load game details from Steam.",
				detail: error.message,
			});
		}
	});

	app.get("/api/game/:appid/bundles", async (req, res) => {
		const appid = String(req.params.appid);
		if (!/^\d+$/.test(appid))
			return res.status(400).json({ error: "AppID must be numeric." });
		const cc = String(req.query.cc || "US")
			.slice(0, 2)
			.toUpperCase();
		const key = `bundles:${appid}:${cc}`;
		const hit = cached(key);
		if (hit) return res.json(hit);
		const result = await fetchSteamBundles(appid, cc);
		// Negative results may reflect transient or incomplete Steam HTML.
		// Retry discovery soon instead of caching an empty result for five minutes.
		const ttl =
			result.bundles.length || result.franchise ? CACHE_TTL : 30 * 1000;
		return res.json(saveCache(key, result, ttl));
	});

	app.get("/api/game/:appid/dlc", async (req, res) => {
		const appid = String(req.params.appid);
		if (!/^\d+$/.test(appid))
			return res.status(400).json({ error: "AppID must be numeric." });

		const cc = String(req.query.cc || "US")
			.slice(0, 2)
			.toUpperCase();
		const offset = Math.max(
			0,
			Number.parseInt(req.query.offset || "0", 10) || 0,
		);
		const limit = Math.min(
			24,
			Math.max(1, Number.parseInt(req.query.limit || "24", 10) || 24),
		);

		try {
			const parentUrl = new URL(
				"https://store.steampowered.com/api/appdetails",
			);
			parentUrl.searchParams.set("appids", appid);
			parentUrl.searchParams.set("cc", cc);
			parentUrl.searchParams.set("l", "english");
			const parentResponse = await fetchJson(parentUrl);
			const parent = parentResponse?.[appid];
			if (!parent?.success || !parent.data)
				return res
					.status(404)
					.json({ error: "Steam did not return details for this game." });

			const allIds = Array.isArray(parent.data.dlc)
				? [...new Set(parent.data.dlc.map(Number).filter(Number.isFinite))]
				: [];
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
					price:
						item.price_overview?.final_formatted ||
						(item.price_overview
							? new Intl.NumberFormat("en-US", {
									style: "currency",
									currency: item.price_overview.currency || "USD",
								}).format(item.price_overview.final / 100)
							: item.is_free
								? "Free"
								: null),
					url: `https://store.steampowered.com/app/${dlcId}/`,
				};
			});
			const items = results
				.filter((item) => item.status === "fulfilled" && item.value)
				.map((item) => item.value);
			res.json({
				items,
				total: allIds.length,
				nextOffset: offset + ids.length,
				hasMore: offset + ids.length < allIds.length,
			});
		} catch (error) {
			console.error(`Failed to load more DLC for AppID ${appid}:`, error);
			res
				.status(502)
				.json({
					error: "Could not load more DLC from Steam.",
					detail: error.message,
				});
		}
	});
}
