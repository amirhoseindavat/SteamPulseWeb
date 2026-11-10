const responseCache = new Map();

function cloneData(data) {
  return data == null ? data : JSON.parse(JSON.stringify(data));
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
    throw new Error("The SteamPulse API returned an empty response. Make sure both the Vite client and Express server are running with npm run dev.");
  }
  try { return JSON.parse(text); }
  catch {
    throw new Error("The API returned a non-JSON response. Open the app through the Vite dev server and check that the Express API is running on port 3001.");
  }
}

export async function requestJson(
  url,
  options = {},
  fallbackMessage = "The request could not be completed.",
  { cacheTtl = 0 } = {}
) {
  const method = String(options.method || "GET").toUpperCase();
  const cacheKey = method === "GET" && cacheTtl > 0 ? String(url).replace(/([?&])refresh=1(&|$)/, (match, prefix, suffix) => suffix ? prefix : "").replace(/[?&]$/, "") : "";
  const forceRefresh = /[?&]refresh=1(?:&|$)/.test(url);
  const cachedEntry = cacheKey && !forceRefresh ? responseCache.get(cacheKey) : null;

  if (cachedEntry) {
    if (Date.now() - cachedEntry.at < cachedEntry.ttl) return cloneData(cachedEntry.data);
    responseCache.delete(cacheKey);
  }

  const response = await fetch(url, options);
  const data = await readApiResponse(response);
  if (!response.ok) throw new Error(data.error || data.detail || fallbackMessage);

  if (cacheKey && !options.signal?.aborted) {
    responseCache.set(cacheKey, { at: Date.now(), ttl: cacheTtl, data: cloneData(data) });
  }
  return data;
}
