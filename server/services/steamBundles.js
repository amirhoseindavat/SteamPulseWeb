import { decodeSteamHtml } from "../utils/steamHtml.js";

function extractSteamBundleIds(html = "") {
	const normalized = String(html)
		.replace(/\\u002f/gi, "/")
		.replace(/\\\//g, "/")
		.replace(/&#x2f;|&#47;|&sol;/gi, "/")
		.replace(/\\u0022/gi, '"')
		.replace(/\\"/g, '"');

	const ids = new Set();
	const add = (value) => {
		const id = Number(value);
		if (Number.isSafeInteger(id) && id > 0) ids.add(id);
	};

	for (const match of normalized.matchAll(/\/bundle\/(\d+)/gi)) add(match[1]);
	for (const match of normalized.matchAll(
		/(?:data-ds-bundleid|data-bundleid|bundleid|bundle_id)\s*(?:=|:)\s*["']?(\d+)/gi,
	))
		add(match[1]);
	for (const match of normalized.matchAll(
		/["']bundleids?["']\s*:\s*\[([^\]]+)\]/gi,
	)) {
		for (const id of match[1].matchAll(/\d+/g)) add(id[0]);
	}
	return [...ids];
}

function extractSteamFranchise(html) {
	const anchorMatch = String(html || "").match(
		/<a\b(?=[^>]*\bclass=["'][^"']*\bfranchise_notice\b[^"']*["'])[^>]*>[\s\S]*?<\/a>/i,
	);
	if (!anchorMatch) return null;

	const anchor = anchorMatch[0];
	const href = anchor.match(/\bhref=["']([^"']+)["']/i)?.[1];
	const name = anchor.match(
		/<div\b(?=[^>]*\bclass=["'][^"']*\bfranchise_name\b)[^>]*>([\s\S]*?)<\/div>/i,
	)?.[1];
	const background = anchor.match(
		/<div\b(?=[^>]*\bclass=["'][^"']*\bbackground_image\b)[^>]*\bstyle=["'][^"']*background-image\s*:\s*url\((['"]?)(.*?)\1\)[^"']*["']/i,
	)?.[2];
	if (!href || !name) return null;

	const clean = (value) => decodeSteamHtml(value).trim();
	const url = clean(href);
	if (!/^https?:\/\/store\.steampowered\.com\/franchise\//i.test(url))
		return null;
	return {
		url,
		name: clean(name).replace(/\s+/g, " "),
		image: background ? clean(background) : "",
	};
}

export async function fetchSteamBundles(appid, cc, fetchJsonWithOptions) {
	const startedAt = Date.now();
	const currency =
		cc === "GB"
			? "GBP"
			: cc === "DE"
				? "EUR"
				: cc === "TR"
					? "TRY"
					: cc === "PL"
						? "PLN"
						: cc === "BR"
							? "BRL"
							: cc === "IN"
								? "INR"
								: cc === "UA"
									? "UAH"
									: cc === "AR"
										? "ARS"
										: "USD";
	const headers = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
		Accept: "text/html,application/json, */*",
		"Accept-Language": "en-US,en;q=0.9",
	};

	// Steam's mature-game Age Gate otherwise redirects Node fetch between
	// /app/ and /agecheck/ because fetch does not persist browser cookies.
	// These cookies mirror the successful browser-style age confirmation.
	const steamStoreHeaders = {
		...headers,
		Cookie:
			"birthtime=631152001; lastagecheckage=1-January-1990; wants_mature_content=1",
	};

	for (let attempt = 1; attempt <= 2; attempt++) {
		try {
			const pageUrl = new URL(
				"https://store.steampowered.com/app/" + appid + "/",
			);
			pageUrl.searchParams.set("cc", cc);
			pageUrl.searchParams.set("l", "english");

			// Treat the app page and bundles listing as independent discovery sources.
			// Steam can fail one route while the other remains reachable.
			let appIds = [];
			let franchise = null;
			let appPageStatus = "error";
			try {
				const appResponse = await fetch(pageUrl, {
					headers: steamStoreHeaders,
					signal: AbortSignal.timeout(15000),
				});
				appPageStatus = appResponse.status;
				if (appResponse.ok) {
					const appHtml = await appResponse.text();
					appIds = extractSteamBundleIds(appHtml);
					franchise = extractSteamFranchise(appHtml);
				}
			} catch (appPageError) {
				console.warn(
					"[SteamPulse bundles] AppID " +
						appid +
						": app page request failed: " +
						appPageError.message,
				);
			}

			let listingIds = [];
			let listingStatus = "unavailable";
			try {
				const listingUrl = new URL(
					"https://store.steampowered.com/app/" + appid + "/bundles/",
				);
				listingUrl.searchParams.set("cc", cc);
				listingUrl.searchParams.set("l", "english");
				const listingResponse = await fetch(listingUrl, {
					headers: steamStoreHeaders,
					signal: AbortSignal.timeout(12000),
				});
				listingStatus = listingResponse.status;
				if (listingResponse.ok)
					listingIds = extractSteamBundleIds(await listingResponse.text());
			} catch (listingError) {
				listingStatus = "error";
				console.warn(
					"[SteamPulse bundles] AppID " +
						appid +
						": listing request failed: " +
						listingError.message,
				);
			}

			const bundleIds = [...new Set([...appIds, ...listingIds])].slice(0, 40);
			console.info(
				"[SteamPulse bundles] AppID " +
					appid +
					" cc=" +
					cc +
					" attempt=" +
					attempt +
					": appPageStatus=" +
					appPageStatus +
					", appIds=" +
					appIds.length +
					", listingIds=" +
					listingIds.length +
					", listingStatus=" +
					listingStatus +
					", uniqueIds=" +
					bundleIds.length,
			);

			if (!bundleIds.length) {
				if (attempt === 1) {
					await new Promise((resolve) => setTimeout(resolve, 700));
					continue;
				}
				console.warn(
					"[SteamPulse bundles] AppID " +
						appid +
						": no bundle IDs discovered after 2 attempts (" +
						(Date.now() - startedAt) +
						"ms)",
				);
				return { bundles: [], franchise };
			}

			const bundleUrl = new URL(
				"https://store.steampowered.com/actions/ajaxresolvebundles",
			);
			bundleUrl.searchParams.set("bundleids", bundleIds.join(","));
			bundleUrl.searchParams.set("cc", cc);
			bundleUrl.searchParams.set("l", "english");
			const resolved = await fetchJsonWithOptions(bundleUrl, {
				headers: {
					...steamStoreHeaders,
					Referer: pageUrl.toString(),
					"X-Requested-With": "XMLHttpRequest",
				},
				signal: AbortSignal.timeout(15000),
			});

			const bundlePayload = Array.isArray(resolved)
				? resolved
				: Array.isArray(resolved?.bundles)
					? resolved.bundles
					: Array.isArray(resolved?.bundle_data)
						? resolved.bundle_data
						: Array.isArray(resolved?.data)
							? resolved.data
							: resolved;
			const rawBundles = Array.isArray(bundlePayload)
				? bundlePayload
				: bundlePayload && typeof bundlePayload === "object"
					? Object.entries(bundlePayload)
							.filter(([, value]) => value && typeof value === "object")
							.map(([id, bundle]) => ({
								...bundle,
								bundleid:
									bundle.bundleid || bundle.bundle_id || bundle.id || id,
							}))
					: [];

			const byId = new Map();
			for (const bundle of rawBundles) {
				const id = Number(bundle?.bundleid || bundle?.bundle_id || bundle?.id);
				if (!bundle || !bundleIds.includes(id)) continue;
				byId.set(id, bundle);
			}

			const bundles = bundleIds
				.filter((id) => byId.has(id))
				.map((id) => {
					const bundle = byId.get(id);
					const finalPrice = bundle.final_price ?? bundle.price;
					const originalPrice = bundle.original_price ?? bundle.initial_price;
					const finalValue =
						finalPrice != null && Number.isFinite(Number(finalPrice))
							? Number(finalPrice) / 100
							: null;
					const originalValue =
						originalPrice != null && Number.isFinite(Number(originalPrice))
							? Number(originalPrice) / 100
							: null;
					// Steam's bundle discount_percent can be stale or inconsistent with
					// the actual prices. Derive it from the original and final prices.
					const savings =
						originalValue != null && finalValue != null && originalValue > 0
							? finalValue < originalValue
								? String(Math.round((1 - finalValue / originalValue) * 100))
								: ""
							: bundle.discount_percent != null
								? String(bundle.discount_percent)
								: "";
					return {
						id,
						name: bundle.name || bundle.bundle_name || "Steam Bundle",
						image:
							bundle.header_image_url ||
							bundle.header_image ||
							bundle.main_capsule ||
							"",
						priceValue: finalValue,
						price:
							bundle.formatted_final_price ||
							bundle.price_formatted ||
							(finalValue != null
								? new Intl.NumberFormat("en-US", {
										style: "currency",
										currency,
									}).format(finalValue)
								: null),
						originalPrice:
							bundle.formatted_original_price ||
							(originalValue != null
								? new Intl.NumberFormat("en-US", {
										style: "currency",
										currency,
									}).format(originalValue)
								: null),
						savings,
						appCount: Array.isArray(bundle.appids)
							? bundle.appids.length
							: null,
						url: "https://store.steampowered.com/bundle/" + id + "/",
					};
				});

			console.info(
				"[SteamPulse bundles] AppID " +
					appid +
					" cc=" +
					cc +
					": requestedIds=" +
					bundleIds.length +
					", resolvedBundles=" +
					bundles.length +
					", rawItems=" +
					rawBundles.length +
					", duration=" +
					(Date.now() - startedAt) +
					"ms",
			);
			if (!bundles.length)
				console.warn(
					"[SteamPulse bundles] AppID " +
						appid +
						": Steam returned no resolvable bundle data for discovered IDs.",
				);
			return { bundles, franchise };
		} catch (error) {
			if (attempt === 1) {
				console.warn(
					"[SteamPulse bundles] AppID " +
						appid +
						" attempt 1 failed; retrying: " +
						error.message,
				);
				await new Promise((resolve) => setTimeout(resolve, 700));
			} else {
				console.warn(
					"[SteamPulse bundles] AppID " +
						appid +
						" failed after 2 attempts (" +
						(Date.now() - startedAt) +
						"ms): " +
						error.message,
				);
			}
		}
	}
	return { bundles: [], franchise: null };
}
