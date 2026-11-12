const API_BASE_URL = (
	import.meta.env.VITE_API_BASE_URL ||
	(import.meta.env.PROD ? "https://steampulse-eu82.onrender.com" : "")
).replace(/\/+$/, "");

const responseCache = new Map();
const MAX_CACHE_ENTRIES = 200;

function cloneData(data) {
	return data == null ? data : JSON.parse(JSON.stringify(data));
}

function resolveApiUrl(url) {
	if (/^https?:\/\//i.test(url)) return url;
	return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

export function clearApiCache(prefix = "") {
	if (!prefix) {
		responseCache.clear();
		return;
	}
	for (const key of responseCache.keys()) {
		if (key.startsWith(prefix)) responseCache.delete(key);
	}
}

export async function readApiResponse(response) {
	const text = await response.text();
	if (!text.trim()) {
		throw new Error("The SteamPulse API returned an empty response.");
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(
			"The SteamPulse API returned a non-JSON response. Check the API service and its deployment logs.",
		);
	}
}

export async function requestJson(
	url,
	options = {},
	fallbackMessage = "The request could not be completed.",
	{ cacheTtl = 0 } = {},
) {
	const requestUrl = resolveApiUrl(url);
	const method = String(options.method || "GET").toUpperCase();
	const cacheKey =
		method === "GET" && cacheTtl > 0
			? String(requestUrl)
					.replace(/([?&])refresh=1(&|$)/, (match, prefix, suffix) =>
						suffix ? prefix : "",
					)
					.replace(/[?&]$/, "")
			: "";
	const forceRefresh = /[?&]refresh=1(?:&|$)/.test(requestUrl);
	const cachedEntry =
		cacheKey && !forceRefresh ? responseCache.get(cacheKey) : null;

	if (cachedEntry) {
		if (Date.now() - cachedEntry.at < cachedEntry.ttl)
			return cloneData(cachedEntry.data);
		responseCache.delete(cacheKey);
	}

	const response = await fetch(requestUrl, options);
	const data = await readApiResponse(response);
	if (!response.ok)
		throw new Error(data.error || data.detail || fallbackMessage);

	if (cacheKey && !options.signal?.aborted) {
		const now = Date.now();
		for (const [key, entry] of responseCache) {
			if (now - entry.at >= entry.ttl) responseCache.delete(key);
		}
		if (
			!responseCache.has(cacheKey) &&
			responseCache.size >= MAX_CACHE_ENTRIES
		) {
			responseCache.delete(responseCache.keys().next().value);
		}
		responseCache.set(cacheKey, {
			at: now,
			ttl: cacheTtl,
			data: cloneData(data),
		});
	}
	return data;
}
