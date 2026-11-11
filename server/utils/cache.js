export const CACHE_TTL = 15 * 60 * 1000;
export const DISCOVERY_CACHE_TTL = 60 * 60 * 1000;
export const STALE_CACHE_TTL = 6 * 60 * 60 * 1000;

const cache = new Map();
const inFlight = new Map();
const backgroundRefreshers = new Map();
let refreshTimer = null;

export function cached(key) {
	const entry = cache.get(key);
	if (!entry) return null;
	const ttl = entry.ttl ?? CACHE_TTL;
	const age = Date.now() - entry.at;
	if (age < ttl) return entry.value;
	if (age >= ttl + (entry.staleTtl ?? 0)) cache.delete(key);
	return null;
}

export function staleCached(key) {
	const entry = cache.get(key);
	if (!entry) return null;
	const ttl = entry.ttl ?? CACHE_TTL;
	const staleTtl = entry.staleTtl ?? 0;
	const age = Date.now() - entry.at;
	return age >= ttl && age < ttl + staleTtl ? entry.value : null;
}

export function saveCache(key, value, ttl = CACHE_TTL, staleTtl = 0) {
	cache.set(key, { at: Date.now(), value, ttl, staleTtl });
	return value;
}

// Share concurrent work for the same resource within this Node process.
export function coalesce(key, loader) {
	if (inFlight.has(key)) return inFlight.get(key);

	const request = Promise.resolve()
		.then(loader)
		.finally(() => {
			if (inFlight.get(key) === request) inFlight.delete(key);
		});

	inFlight.set(key, request);
	return request;
}

export function refreshInBackground(key) {
	const refresh = backgroundRefreshers.get(key);
	if (!refresh) return;
	refresh.lastAttempt = Date.now();

	coalesce(`background-refresh:${key}`, refresh.loader).catch((error) => {
		console.warn(`Background cache refresh failed for ${key}:`, error.message);
	});
}

export function registerBackgroundRefresh(key, loader, ttl = DISCOVERY_CACHE_TTL) {
	const existing = backgroundRefreshers.get(key);
	backgroundRefreshers.set(key, {
		loader,
		ttl,
		lastAttempt: existing?.lastAttempt || 0,
	});

	if (refreshTimer) return;
	refreshTimer = setInterval(() => {
		const now = Date.now();
		for (const [cacheKey, refresh] of backgroundRefreshers) {
			const entry = cache.get(cacheKey);
			if (!entry) continue;

			const age = now - entry.at;
			const retryDelay = Math.min(5 * 60 * 1000, refresh.ttl / 6);
			if (
				age >= refresh.ttl - retryDelay &&
				now - refresh.lastAttempt >= retryDelay
			) {
				refresh.lastAttempt = now;
				refreshInBackground(cacheKey);
			}
		}
	}, 60 * 1000);

	refreshTimer.unref?.();
}
