const STEAM_REQUEST_TIMEOUT_MS = 10000;
const MAX_CONCURRENT_STEAM_REQUESTS = 3;
const MAX_RESPONSE_CACHE_ENTRIES = 2000;
const RESPONSE_STALE_TTL_MS = 6 * 60 * 60 * 1000;
const inflightRequests = new Map();
const responseCache = new Map();
const requestQueue = [];
let activeRequests = 0;
let steamCooldownUntil = 0;
let cooldownTimer = null;

function getResponseCacheTtl(url) {
	const value = String(url);
	if (/\/api\/appdetails(?:\?|$)/i.test(value)) return 30 * 60 * 1000;
	if (/ajaxgetdeckappcompatibilityreport|IStoreBrowseService\/GetItems|api\.steamcmd\.net\/v1\/info/i.test(value))
		return 24 * 60 * 60 * 1000;
	if (/GetNumberOfCurrentPlayers/i.test(value)) return 2 * 60 * 1000;
	if (/ISteamNews\/GetNewsForApp/i.test(value)) return 10 * 60 * 1000;
	return 5 * 60 * 1000;
}

function enqueueSteamRequest(url, options) {
	return new Promise((resolve, reject) => {
		requestQueue.push({ url, options, resolve, reject });
		pumpRequestQueue();
	});
}

function pumpRequestQueue() {
	if (Date.now() < steamCooldownUntil) {
		if (!cooldownTimer) {
			cooldownTimer = setTimeout(() => {
				cooldownTimer = null;
				pumpRequestQueue();
			}, steamCooldownUntil - Date.now());
		}
		return;
	}

	while (
		activeRequests < MAX_CONCURRENT_STEAM_REQUESTS &&
		requestQueue.length
	) {
		const job = requestQueue.shift();
		activeRequests++;
		fetchJsonRequest(job.url, job.options)
			.then(job.resolve, job.reject)
			.finally(() => {
				activeRequests--;
				pumpRequestQueue();
			});
	}
}

function rememberResponse(key, value, ttl) {
	responseCache.delete(key);
	responseCache.set(key, { value, at: Date.now(), ttl });
	while (responseCache.size > MAX_RESPONSE_CACHE_ENTRIES) {
		responseCache.delete(responseCache.keys().next().value);
	}
}

function getCachedResponse(key, allowStale = false) {
	const entry = responseCache.get(key);
	if (!entry) return null;
	const age = Date.now() - entry.at;
	if (age < entry.ttl) return entry.value;
	if (allowStale && age < entry.ttl + RESPONSE_STALE_TTL_MS) {
		return entry.value;
	}
	if (age >= entry.ttl + RESPONSE_STALE_TTL_MS) responseCache.delete(key);
	return null;
}

async function fetchJsonRequest(url, options = {}) {
	const response = await fetch(url, {
		...options,
		headers: options.headers || { "User-Agent": "SteamPulseWeb/1.0" },
		signal: options.signal || AbortSignal.timeout(STEAM_REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) {
		const error = new Error(`Steam request failed (${response.status})`);
		error.status = response.status;
		error.retryAfter = response.headers.get("retry-after");
		if (response.status === 429) {
			const retryAfter = Number(error.retryAfter);
			const retryAt = Number.isFinite(retryAfter) && retryAfter > 0
				? Date.now() + retryAfter * 1000
				: Date.now() + 30 * 1000;
			steamCooldownUntil = Math.max(steamCooldownUntil, retryAt);
		}
		throw error;
	}

	// Steam occasionally responds with an empty body or non-JSON content.
	// Read the body once so those upstream failures become actionable API errors.
	const responseText = await response.text();
	if (!responseText.trim()) {
		throw new Error(
			`Steam returned an empty response (HTTP ${response.status}). Please retry in a moment.`,
		);
	}

	try {
		return JSON.parse(responseText);
	} catch {
		const contentType =
			response.headers.get("content-type") || "unknown content type";
		throw new Error(
			`Steam returned invalid JSON (${contentType}, HTTP ${response.status}). Please retry in a moment.`,
		);
	}
}

// Share identical simultaneous requests so repeated UI actions don't multiply Steam traffic.
export function fetchJson(url, options = {}) {
	const key = `${String(url)}|json|${options.headers ? JSON.stringify(options.headers) : ""}`;
	const fresh = getCachedResponse(key);
	if (fresh !== null) return Promise.resolve(fresh);
	if (inflightRequests.has(key)) return inflightRequests.get(key);

	const ttl = getResponseCacheTtl(url);
	const request = enqueueSteamRequest(url, options)
		.then((data) => {
			rememberResponse(key, data, ttl);
			return data;
		})
		.catch((error) => {
			// Keep game pages usable during temporary Steam throttling/outages.
			const stale = getCachedResponse(key, true);
			if (stale !== null) {
				console.warn(`Serving stale Steam response after upstream failure: ${String(url)}`);
				return stale;
			}
			throw error;
		})
		.finally(() => {
			if (inflightRequests.get(key) === request) inflightRequests.delete(key);
		});
	inflightRequests.set(key, request);
	return request;
}

export async function fetchJsonWithOptions(url, options = {}) {
	return fetchJson(url, options);
}

export async function fetchSteamDbLogo(appid) {
	try {
		const response = await fetch(
			`https://steamdb.info/app/${encodeURIComponent(appid)}/`,
			{
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
					Accept: "text/html,application/xhtml+xml",
					"Accept-Language": "en-US,en;q=0.9",
				},
				signal: AbortSignal.timeout(7000),
			},
		);
		if (!response.ok) return "";
		const html = await response.text();

		// SteamDB exposes the hashed filename for library logos even when
		// StoreBrowse omits logo/library_logo from its assets response.
		const match = html.match(
			new RegExp(
				`(?:steam/apps/${appid}/)?([a-f0-9]{40}/logo(?:_2x)?\\.png)`,
				"i",
			),
		);
		if (!match) return "";
		return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/${match[1]}`;
	} catch {
		return "";
	}
}

export async function fetchSteamHeaderImage(appid) {
	const fallback = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
	try {
		const data = await fetchJson(
			`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appid)}&filters=basic`,
			{
				headers: {
					"User-Agent": "Mozilla/5.0 SteamPulseWeb/1.0",
					Accept: "application/json",
				},
			},
		);
		const app = data?.[String(appid)];
		const image = app?.success ? app?.data?.header_image : "";
		return typeof image === "string" && image.startsWith("https://")
			? image
			: fallback;
	} catch {
		return fallback;
	}
}

export async function mapWithConcurrency(items, concurrency, mapper) {
	const results = new Array(items.length);
	let nextIndex = 0;
	async function worker() {
		while (true) {
			const index = nextIndex++;
			if (index >= items.length) return;
			try {
				results[index] = {
					status: "fulfilled",
					value: await mapper(items[index], index),
				};
			} catch (reason) {
				results[index] = { status: "rejected", reason };
			}
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
	);
	return results;
}
