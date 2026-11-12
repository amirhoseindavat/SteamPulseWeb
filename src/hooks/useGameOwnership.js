import { useEffect, useRef, useState } from "react";
import { checkSteamOwnership } from "../services/steamPulseApi";

export function useGameOwnership({
	game,
	currentPage,
	steamProfile,
	steamApiKey,
}) {
	const [ownership, setOwnership] = useState(null);
	const [ownershipLoading, setOwnershipLoading] = useState(false);
	const [ownershipError, setOwnershipError] = useState("");
	const requestRef = useRef(null);
	const requestIdRef = useRef(0);

	async function checkOwnership() {
		if (!steamProfile.trim() || !game) {
			setOwnershipError("Add your Steam profile in Settings first.");
			return;
		}

		requestRef.current?.abort();
		const controller = new AbortController();
		requestRef.current = controller;
		const requestId = ++requestIdRef.current;
		setOwnershipLoading(true);
		setOwnershipError("");

		try {
			const appids = [
				...new Set(
					[
						Number(game.appid),
						...(game.dlc || []).map((item) => Number(item.appid)),
					].filter(Number.isFinite),
				),
			];

			const data = await checkSteamOwnership(
				steamProfile,
				appids,
				steamApiKey,
				controller.signal,
			);
			if (!controller.signal.aborted && requestId === requestIdRef.current)
				setOwnership(data);
		} catch (error) {
			if (!controller.signal.aborted && requestId === requestIdRef.current) {
				setOwnershipError(error.message || "Ownership check failed.");
			}
		} finally {
			if (!controller.signal.aborted && requestId === requestIdRef.current)
				setOwnershipLoading(false);
		}
	}

	useEffect(() => {
		if (
			currentPage === "game" &&
			game?.appid &&
			String(game.type || "").toLowerCase() !== "hardware" &&
			steamProfile &&
			steamApiKey
		) {
			checkOwnership();
		} else {
			requestRef.current?.abort();
			setOwnershipLoading(false);
		}
	}, [currentPage, game?.appid, steamProfile, steamApiKey]);

	useEffect(() => () => requestRef.current?.abort(), []);

	function resetOwnership() {
		requestRef.current?.abort();
		requestIdRef.current += 1;
		setOwnership(null);
		setOwnershipError("");
		setOwnershipLoading(false);
	}

	return {
		ownership,
		ownershipLoading,
		ownershipError,
		checkOwnership,
		resetOwnership,
	};
}
