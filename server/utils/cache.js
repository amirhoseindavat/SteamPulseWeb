export const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();
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
