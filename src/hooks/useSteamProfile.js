import { useEffect, useState } from "react";
import { getSteamProfile } from "../services/steamPulseApi";

export function useSteamProfile({
	currentPage,
	profileRouteId,
	setProfileRouteId,
	steamProfile,
	steamApiKey,
}) {
	const [steamProfileData, setSteamProfileData] = useState(null);
	const [personalSteamProfileData, setPersonalSteamProfileData] =
		useState(null);
	const [steamProfileLoading, setSteamProfileLoading] = useState(false);
	const [steamProfileError, setSteamProfileError] = useState("");

	async function loadSteamProfile(profileOverride = "") {
		const targetProfile = String(profileOverride || steamProfile || "").trim();
		if (!targetProfile) {
			setSteamProfileData(null);
			setSteamProfileError(
				"Add your Steam profile in Settings first, then save it.",
			);
			return;
		}
		setSteamProfileLoading(true);
		setSteamProfileError("");
		setSteamProfileData(null);
		try {
			const data = await getSteamProfile(targetProfile, steamApiKey);
			setSteamProfileData(data);
			if (targetProfile === String(steamProfile || "").trim())
				setPersonalSteamProfileData(data);
		} catch (error) {
			setSteamProfileError(
				error.message || "Could not load the Steam profile.",
			);
		} finally {
			setSteamProfileLoading(false);
		}
	}

	useEffect(() => {
		if (currentPage === "profile" || steamProfile.trim())
			loadSteamProfile(profileRouteId || steamProfile);
	}, [currentPage, steamProfile, profileRouteId]);

	useEffect(() => {
		if (
			currentPage !== "profile" ||
			profileRouteId ||
			!personalSteamProfileData?.profile?.steamId
		)
			return;
		const ownProfileHash = `#/profile/${personalSteamProfileData.profile.steamId}`;
		if (window.location.hash !== ownProfileHash)
			window.history.replaceState(null, "", ownProfileHash);
		setProfileRouteId(personalSteamProfileData.profile.steamId);
	}, [currentPage, profileRouteId, personalSteamProfileData?.profile?.steamId]);

	useEffect(() => {
		if (currentPage !== "profile" || !profileRouteId || !steamProfile.trim())
			return;
		if (personalSteamProfileData?.profile?.steamId) return;
		let cancelled = false;
		getSteamProfile(steamProfile.trim(), steamApiKey)
			.then((data) => {
				if (!cancelled) setPersonalSteamProfileData(data);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [
		currentPage,
		profileRouteId,
		steamProfile,
		steamApiKey,
		personalSteamProfileData?.profile?.steamId,
	]);

	const isOwnSteamProfile = Boolean(
		steamProfileData?.profile?.steamId &&
		(steamProfileData.profile.steamId ===
			personalSteamProfileData?.profile?.steamId ||
			(/^\d{17}$/.test(steamProfile.trim()) &&
				steamProfileData.profile.steamId === steamProfile.trim())),
	);

	return {
		steamProfileData,
		personalSteamProfileData,
		setPersonalSteamProfileData,
		steamProfileLoading,
		steamProfileError,
		loadSteamProfile,
		isOwnSteamProfile,
	};
}
