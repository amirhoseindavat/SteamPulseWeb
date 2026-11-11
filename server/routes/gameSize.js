const GAME_SIZE_CACHE_TTL = 60 * 60 * 1000;

function decodeHtml(value = "") {
	return String(value)
		.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, " ")
		.replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&#x([\\da-f]+);/gi, (_, hex) =>
			String.fromCodePoint(parseInt(hex, 16)),
		)
		.replace(/&#(\\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/\\s+/g, " ")
		.trim();
}

function toBytes(value, unit) {
	const amount = Number(value.replace(/,/g, ""));
	const powers = {
		B: 0,
		KiB: 1,
		MiB: 2,
		GiB: 3,
		TiB: 4,
	};
	if (!Number.isFinite(amount) || powers[unit] == null) return null;
	return Math.round(amount * 1024 ** powers[unit]);
}

function parseSizeSummary(html, appid) {
	const text = decodeHtml(html);
	const appMatch = text.match(new RegExp("App ID\\s*\\|?\\s*" + appid));
	if (!appMatch) {
		throw new Error("SteamDB page did not contain the requested AppID.");
	}

	const filteredSummary = text.match(
		/Total size on disk is ([\\d,.]+)\\s*(B|KiB|MiB|GiB|TiB) and total download size is ([\\d,.]+)\\s*(B|KiB|MiB|GiB|TiB), when filtered to Windows, English, no DLC depots\\.?/i,
	);
	if (!filteredSummary) {
		if (/enable javascript|checking your browser|cloudflare/i.test(text)) {
			throw new Error("SteamDB returned an anti-bot or JavaScript challenge.");
		}
		throw new Error(
			"SteamDB did not expose the Windows/English/no-DLC size summary for this game.",
		);
	}

	const title = html.match(/<h1\\b[^>]*>([\\s\\S]*?)<\\/h1>/i);
	const buildSection = text.match(
		/Branches\\s+Name\\s+Description\\s+Build ID\\s+Time Built\\s+Time Updated\\s+public\\s+([^ ]*)/i,
	);

	const installSize = {
		value: Number(filteredSummary[1].replace(/,/g, "")),
		unit: filteredSummary[2],
		bytes: toBytes(filteredSummary[1], filteredSummary[2]),
	};
	const downloadSize = {
		value: Number(filteredSummary[3].replace(/,/g, "")),
		unit: filteredSummary[4],
		bytes: toBytes(filteredSummary[3], filteredSummary[4]),
	};

	return {
		appid: Number(appid),
		name: title ? decodeHtml(title[1]) : "Unknown game",
		platform: "Windows",
		language: "English",
		includesDlc: false,
		installSize,
		downloadSize,
		buildId: buildSection?.[1] || null,
		source: "SteamDB",
		sourceUrl: `https://steamdb.info/app/${appid}/depots/`,
		fetchedAt: new Date().toISOString(),
	};
}

export function registerGameSizeRoutes(app, { cached, saveCache, coalesce }) {
	app.get("/api/game-size/:appid", async (req, res) => {
		const appid = String(req.params.appid || "");
		if (!/^\\d{1,12}$/.test(appid) || Number(appid) <= 0) {
			return res.status(400).json({ error: "AppID must be a positive number." });
		}

		const cacheKey = `game-size:v1:${appid}:windows:english:no-dlc`;
		const hit = cached(cacheKey);
		if (hit) return res.json({ ...hit, cached: true });

		try {
			const result = await coalesce(cacheKey, async () => {
				const url = `https://steamdb.info/app/${appid}/depots/`;
				const response = await fetch(url, {
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
						Accept: "text/html,application/xhtml+xml",
						"Accept-Language": "en-US,en;q=0.9",
					},
					signal: AbortSignal.timeout(20000),
				});
				if (!response.ok) {
					throw new Error(`SteamDB request failed with HTTP ${response.status}.`);
				}
				const html = await response.text();
				if (!html || html.length < 1000) {
					throw new Error("SteamDB returned an empty or incomplete page.");
				}
				return parseSizeSummary(html, appid);
			});

			res.json(saveCache(cacheKey, result, GAME_SIZE_CACHE_TTL));
		} catch (error) {
			console.warn(`SteamDB game-size lookup failed for AppID ${appid}:`, error.message);
			res.status(502).json({
				error: "Could not retrieve game size from SteamDB.",
				detail: error.message,
				appid: Number(appid),
				sourceUrl: `https://steamdb.info/app/${appid}/depots/`,
			});
		}
	});
}
