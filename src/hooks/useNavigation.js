import { useEffect, useRef } from "react";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

export const GAME_SECTION_SLUGS = {
  freeGames: "freegames",
  topSellers: "topsellers",
  upcoming: "comingsoon",
  newReleases: "newreleases",
  preorders: "preorders"
};

export function getGamesSectionFromRoute(route) {
  const match = route.match(/^\/games\/([^/?#]+)\/?$/i);
  const section = match?.[1]?.toLowerCase();
  return ({
    freegames: "freeGames",
    topsellers: "topSellers",
    comingsoon: "upcoming",
    newreleases: "newReleases",
    preorders: "preorders"
  })[section] || "freeGames";
}

export function getRoutePath() {
  const fallbackRoute = new URLSearchParams(window.location.search).get("p");
  if (fallbackRoute) {
    const route = fallbackRoute.startsWith("/") ? fallbackRoute : `/${fallbackRoute}`;
    window.history.replaceState(null, "", `${BASE_PATH}${route}`);
    return route;
  }
  if (window.location.hash.startsWith("#/")) {
    const route = window.location.hash.slice(1);
    window.history.replaceState(null, "", `${BASE_PATH}${route}`);
    return route;
  }
  const pathname = window.location.pathname;
  const route = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname;
  return route || "/";
}

export function useNavigation({
  appid,
  setCurrentPage,
  setGamesSection,
  setProfileRouteId,
  personalSteamProfileData,
  invalidateGameRequest,
  setGame,
  setGameBackground,
  setLoading,
  setError,
  setSearchOpen,
  loadGame,
  region
}) {
  const latestRef = useRef(null);
  latestRef.current = {
    appid,
    setCurrentPage,
    setGamesSection,
    setProfileRouteId,
    personalSteamProfileData,
    invalidateGameRequest,
    setGame,
    setGameBackground,
    setLoading,
    setError,
    setSearchOpen,
    loadGame,
    region
  };

  function navigateTo(page) {
    const state = latestRef.current;
    const nextPath = page === "game" && state.appid
      ? `/game/${state.appid}`
      : page === "profile" && state.personalSteamProfileData?.profile?.steamId
        ? `/profile/${state.personalSteamProfileData.profile.steamId}`
        : page === "games" || page === "trending"
          ? `/games/${GAME_SECTION_SLUGS.freeGames}`
          : `/${page}`;

    if (getRoutePath() !== nextPath) {
      window.history.pushState(null, "", `${BASE_PATH}${nextPath}`);
    }

    state.setSearchOpen(false);
    state.setCurrentPage(page === "trending" ? "games" : page);
    if (page === "games" || page === "trending") state.setGamesSection("freeGames");
    state.setProfileRouteId("");

    if (page !== "game") {
      state.invalidateGameRequest();
      state.setGame(null);
      state.setGameBackground(null);
      state.setLoading(false);
      state.setError("");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateToGamesSection(section) {
    const state = latestRef.current;
    const safeSection = GAME_SECTION_SLUGS[section] ? section : "topSellers";
    const nextPath = `/games/${GAME_SECTION_SLUGS[safeSection]}`;

    if (getRoutePath() !== nextPath) {
      window.history.pushState(null, "", `${BASE_PATH}${nextPath}`);
    }

    state.setCurrentPage("games");
    state.setGamesSection(safeSection);
    state.setProfileRouteId("");
    state.invalidateGameRequest();
    state.setGame(null);
    state.setGameBackground(null);
    state.setLoading(false);
    state.setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    const syncPageFromLocation = () => {
      const state = latestRef.current;
      const route = getRoutePath();
      const gameMatch = route.match(/^\/game\/(\d+)/);

      if (gameMatch) {
        state.setCurrentPage("game");
        const targetId = gameMatch[1];
        if (String(state.game?.appid || "") !== targetId && !state.loading) {
          state.loadGame(targetId, state.region);
        }
        return;
      }

      const pageMatch = route.match(/^\/(home|games|trending|market|sales|calculator|cart|settings|profile)(?:\/([^/?#]+))?\/?$/);
      const routePage = pageMatch?.[1] || "home";
      const nextPage = routePage === "trending" ? "games" : routePage;

      state.setCurrentPage(nextPage);
      state.setGamesSection(routePage === "trending" ? "freeGames" : getGamesSectionFromRoute(route));

      if (routePage === "trending" || (routePage === "games" && !pageMatch?.[2])) {
        window.history.replaceState(null, "", `${BASE_PATH}/games/${GAME_SECTION_SLUGS.freeGames}`);
      }

      state.setProfileRouteId(nextPage === "profile" ? (pageMatch?.[2] || "") : "");

      if (nextPage !== "game") {
        state.invalidateGameRequest();
        state.setGame(null);
        state.setGameBackground(null);
        state.setLoading(false);
      }
    };

    window.addEventListener("popstate", syncPageFromLocation);
    window.addEventListener("hashchange", syncPageFromLocation);
    if (getRoutePath() !== "/") syncPageFromLocation();

    return () => {
      window.removeEventListener("popstate", syncPageFromLocation);
      window.removeEventListener("hashchange", syncPageFromLocation);
    };
  }, []);

  return { navigateTo, navigateToGamesSection };
}
