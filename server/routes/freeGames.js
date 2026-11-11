import {
	DISCOVERY_CACHE_TTL,
	registerBackgroundRefresh,
	refreshInBackground,
	staleCached,
} from "../utils/cache.js";

export function registerFreeGameRoutes(
	app,
	{ fetchJson, cached, saveCache, mapWithConcurrency },
) {
	const registerRefresh = (key, cc) => {
		registerBackgroundRefresh(key, async () => {
			const port = Number(process.env.PORT) || 3001;
			const response = await fetch(
				`http://127.0.0.1:${port}/api/free-games?cc=${encodeURIComponent(cc)}&refresh=1`,
				{ signal: AbortSignal.timeout(120000) },
			);
			if (!response.ok) throw new Error(`Refresh endpoint returned ${response.status}`);
			await response.arrayBuffer();
		}, DISCOVERY_CACHE_TTL);
	};
	app.get("/api/free-games", async (req, res) => {
		const cc = String(req.query.cc || "US")
			.slice(0, 2)
			.toUpperCase();
		const key = `free-games:${cc}`;
		registerRefresh(key, cc);
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
			// Use Steam's own search page for limited-time free promotions.
			// specials=1 + maxprice=free filters the results to free discounted offers,
			// while supportedlang keeps the results relevant to English/Persian users.
			const searchUrl = new URL("https://store.steampowered.com/search/");
			searchUrl.searchParams.set("hwtype", "0");
			searchUrl.searchParams.set("maxprice", "free");
			searchUrl.searchParams.set("supportedlang", "english,persian");
			searchUrl.searchParams.set("specials", "1");
			searchUrl.searchParams.set("ndl", "1");
			searchUrl.searchParams.set("cc", cc);
			searchUrl.searchParams.set("l", "english");

			const response = await fetch(searchUrl, {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
					Accept: "text/html,application/xhtml+xml",
					"Accept-Language": "en-US,en;q=0.9",
				},
				signal: AbortSignal.timeout(12000),
			});
			if (!response.ok)
				throw new Error(`Steam free-offer search failed (${response.status})`);
			const html = await response.text();
			const cleanText = (value) =>
				String(value || "")
					.replace(/<[^>]*>/g, " ")
					.replace(/&amp;/g, "&")
					.replace(/&quot;/g, '"')
					.replace(/&#39;|&apos;/g, "'")
					.replace(/&lt;/g, "<")
					.replace(/&gt;/g, ">")
					.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
						String.fromCharCode(parseInt(hex, 16)),
					)
					.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
					.replace(/\s+/g, " ")
					.trim();

			// Steam search results are rendered as individual search_result_row anchors.
			const rows = [
				...html.matchAll(
					/<a\b[^>]*class=["'][^"']*search_result_row[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
				),
			].map((match) => match[0]);
			const candidates = [];
			for (const row of rows) {
				const idMatch =
					row.match(/data-ds-appid=["'](\d+)["']/i) ||
					row.match(/\/app\/(\d+)/i);
				const nameMatch =
					row.match(
						/<span[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
					) ||
					row.match(
						/<span[^>]*class=["'][^"']*search_name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
					);
				if (!idMatch) continue;
				const id = Number(idMatch[1]);
				const name = cleanText(nameMatch?.[1] || "");
				if (!id || !name || candidates.some((item) => item.id === id)) continue;

				// The search page should be limited-time promotions, not the whole free-to-play catalogue.
				const originalPrice =
					row.match(/discount_original_price[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
					"";
				const finalPrice =
					row.match(/discount_final_price[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
				const rowText = cleanText(row).toLowerCase();
				const looksLikeZeroPriceOffer =
					/(?:^|\s)free(?:\s|$)/i.test(cleanText(finalPrice)) ||
					/play for free|free to keep/i.test(rowText);
				const hasOriginalPrice = Boolean(cleanText(originalPrice));
				if (!looksLikeZeroPriceOffer && !hasOriginalPrice) continue;

				candidates.push({
					id,
					name,
					image: row.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] || "",
					rowText,
					originalPrice: cleanText(originalPrice),
					finalPrice: cleanText(finalPrice),
				});
			}

			const checked = await mapWithConcurrency(
				candidates.slice(0, 30),
				4,
				async (candidate) => {
					const detailUrl = new URL(
						"https://store.steampowered.com/api/appdetails",
					);
					detailUrl.searchParams.set("appids", String(candidate.id));
					detailUrl.searchParams.set("cc", cc);
					detailUrl.searchParams.set("l", "english");
					const details = await fetchJson(detailUrl);
					const envelope = details?.[String(candidate.id)];
					if (
						!envelope?.success ||
						!["game", "dlc"].includes(
							String(envelope.data?.type || "").toLowerCase(),
						)
					)
						return null;

					const game = envelope.data;
					const price = game.price_overview;
					const zeroNow =
						Boolean(game.is_free) || (price && Number(price.final) === 0);
					const hadPaidPrice = Boolean(price && Number(price.initial) > 0);
					const text = candidate.rowText;
					let offerType = "";
					if (
						/free to keep|keep forever|free to own/i.test(text) ||
						(zeroNow && hadPaidPrice)
					) {
						offerType = "FREE TO KEEP";
					} else if (/play for free|free weekend|free weekend/i.test(text)) {
						offerType = "FREE WEEKEND";
					}

					// Exclude permanently free-to-play products, but include qualifying free game and DLC promotions.
					if (!offerType) return null;
					return {
						id: candidate.id,
						name: game.name || candidate.name,
						offerType,
						productType: String(game.type || "game").toLowerCase(),
						expires: "",
						image:
							game.header_image ||
							candidate.image ||
							`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${candidate.id}/header.jpg`,
						url: `https://store.steampowered.com/app/${candidate.id}/?cc=${cc}`,
						releaseDate: game.release_date?.date || "",
						originalPrice:
							price?.initial_formatted || candidate.originalPrice || "",
						currentPrice:
							price?.final_formatted || candidate.finalPrice || "Free",
					};
				},
			);
			const items = checked
				.filter((entry) => entry.status === "fulfilled" && entry.value)
				.map((entry) => entry.value);
			const result = {
				items,
				source: "Steam Store",
				sourceUrl: searchUrl.toString(),
			};
			res.json(saveCache(key, result, DISCOVERY_CACHE_TTL));
		} catch (error) {
			console.error("Steam free promotions failed:", error);
			res.status(502).json({
				error: "Current free Steam promotions are temporarily unavailable.",
				detail: error.message,
			});
		}
	});
}
