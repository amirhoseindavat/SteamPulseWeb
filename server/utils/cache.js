export const CACHE_TTL = 15 * 60 * 1000;

const cache = new Map();
const inFlight = new Map();

export function cached(key) {
	const entry = cache.get(key);
	const ttl = entry?.ttl ?? CACHE_TTL;
	if (entry && Date.now() - entry.at < ttl) return entry.value;
	cache.delete(key);
	return null;
}

export function saveCache(key, value, ttl = CACHE_TTL) {
	cache.set(key, { at: Date.now(), value, ttl });
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
