import { useEffect, useState } from "react";

export function useAppSettings() {
	const [region, setRegion] = useState(
		() => localStorage.getItem("steampulse-region") || "US",
	);
	const [steamProfile, setSteamProfile] = useState(
		() => localStorage.getItem("steampulse-profile") || "",
	);
	const [steamProfileDraft, setSteamProfileDraft] = useState(
		() => localStorage.getItem("steampulse-profile") || "",
	);
	const [steamApiKey, setSteamApiKey] = useState(
		() => localStorage.getItem("steampulse-api-key") || "",
	);
	const [steamApiKeyDraft, setSteamApiKeyDraft] = useState(
		() => localStorage.getItem("steampulse-api-key") || "",
	);
	const [theme, setTheme] = useState(
		() => localStorage.getItem("steampulse-theme") || "dark",
	);

	useEffect(() => {
		localStorage.setItem("steampulse-region", region);
	}, [region]);

	function saveSettings({ setPersonalSteamProfileData, resetOwnership }) {
		const cleanProfile = steamProfileDraft.trim();
		setSteamProfile(cleanProfile);
		setPersonalSteamProfileData(null);
		localStorage.setItem("steampulse-profile", cleanProfile);

		const cleanApiKey = steamApiKeyDraft.trim();
		setSteamApiKey(cleanApiKey);
		localStorage.setItem("steampulse-api-key", cleanApiKey);
		localStorage.setItem("steampulse-region", region);
		resetOwnership();
	}

	return {
		region,
		setRegion,
		steamProfile,
		setSteamProfile,
		steamProfileDraft,
		setSteamProfileDraft,
		steamApiKey,
		setSteamApiKey,
		steamApiKeyDraft,
		setSteamApiKeyDraft,
		theme,
		setTheme,
		saveSettings,
	};
}
