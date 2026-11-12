import { useEffect, useState } from "react";

const LATEST_RELEASE_URL = "https://api.github.com/repos/amirhoseindavat/SteamPulseWeb/releases/latest";
const FALLBACK_VERSION = "v4.0.0";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedVersion = "";
let cacheExpiresAt = 0;
let pendingRequest = null;

function normalizeVersion(tagName) {
	const tag = String(tagName || "").trim();
	if (!tag) return "";
	return /^[vV]/.test(tag) ? tag : `v${tag}`;
}

async function fetchLatestReleaseVersion() {
	if (cachedVersion && Date.now() < cacheExpiresAt) return cachedVersion;
	if (!pendingRequest) {
		pendingRequest = fetch(LATEST_RELEASE_URL, {
			headers: { Accept: "application/vnd.github+json" },
		})
			.then((response) => {
				if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);
				return response.json();
			})
			.then((release) => {
				const version = normalizeVersion(release?.tag_name);
				if (!version) throw new Error("Latest GitHub release has no tag name.");
				cachedVersion = version;
				cacheExpiresAt = Date.now() + CACHE_TTL_MS;
				return version;
			})
			.finally(() => {
				pendingRequest = null;
			});
	}
	return pendingRequest;
}

export function useLatestReleaseVersion() {
	const [version, setVersion] = useState(cachedVersion || FALLBACK_VERSION);

	useEffect(() => {
		let active = true;
		fetchLatestReleaseVersion()
			.then((latestVersion) => {
				if (active) setVersion(latestVersion);
			})
			.catch((error) => {
				console.warn("Could not load the latest SteamPulse release version:", error);
			});
		return () => {
			active = false;
		};
	}, []);

	return version;
}
