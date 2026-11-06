const STEAM_REQUEST_TIMEOUT_MS = 10000;
const inflightRequests = new Map();


async function fetchJsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.headers || { "User-Agent": "SteamPulseWeb/1.0" },
    signal: options.signal || AbortSignal.timeout(STEAM_REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    const error = new Error(`Steam request failed (${response.status})`);
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }

  // Steam occasionally responds with an empty body or non-JSON content.
  // Read the body once so those upstream failures become actionable API errors.
  const responseText = await response.text();
  if (!responseText.trim()) {
    throw new Error(`Steam returned an empty response (HTTP ${response.status}). Please retry in a moment.`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    const contentType = response.headers.get("content-type") || "unknown content type";
    throw new Error(`Steam returned invalid JSON (${contentType}, HTTP ${response.status}). Please retry in a moment.`);
  }
}

// Share identical simultaneous requests so repeated UI actions don't multiply Steam traffic.
export function fetchJson(url, options = {}) {
  const key = `${String(url)}|json|${options.headers ? JSON.stringify(options.headers) : ""}`;
  if (inflightRequests.has(key)) return inflightRequests.get(key);
  const request = fetchJsonRequest(url, options).finally(() => inflightRequests.delete(key));
  inflightRequests.set(key, request);
  return request;
}

export async function fetchJsonWithOptions(url, options = {}) {
  return fetchJson(url, options);
}

export async function fetchSteamDbLogo(appid) {
  try {
    const response = await fetch(`https://steamdb.info/app/${encodeURIComponent(appid)}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return "";
    const html = await response.text();

    // SteamDB exposes the hashed filename for library logos even when
    // StoreBrowse omits logo/library_logo from its assets response.
    const match = html.match(new RegExp(`(?:steam/apps/${appid}/)?([a-f0-9]{40}/logo(?:_2x)?\\.png)`, "i"));
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
      { headers: { "User-Agent": "Mozilla/5.0 SteamPulseWeb/1.0", "Accept": "application/json" } }
    );
    const app = data?.[String(appid)];
    const image = app?.success ? app?.data?.header_image : "";
    return typeof image === "string" && image.startsWith("https://") ? image : fallback;
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
        results[index] = { status: "fulfilled", value: await mapper(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
