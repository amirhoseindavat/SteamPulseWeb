import { Search, Activity, Gamepad2, Tag, Calculator, ShoppingCart, UserRound, Settings, Sun, Moon, CalendarDays } from "lucide-react";

export default function AppHeader({ currentPage, navigateTo, steamCartApps, headerSearchRef, theme, setTheme, personalSteamProfileData }) {
  return (
    <header className="topbar">
        <a className="brand" href="#/home" onClick={(e) => { e.preventDefault(); navigateTo("home"); }} aria-label="SteamPulse Home">
          <img className="brand-logo" src="https://steampulse.ir/favicon.png" alt="SteamPulse" />
        </a>
        <nav className="main-nav" aria-label="Main navigation">{[["home","Home"],["games","Games"],["market","Market"],["sales","Sales"],["calculator","Calculator"],["cart","Cart"],["settings","Settings"]].map(([page,label]) => <a key={page} href={page === "games" ? "#/games/TopSellers" : `#/${page}`} className={currentPage === page || (currentPage === "game" && page === "games") ? "active" : ""} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigateTo(page); }}>{page === "home" ? <Activity size={15} /> : page === "games" ? <Gamepad2 size={15} /> : page === "market" ? <Tag size={15} /> : page === "sales" ? <CalendarDays size={15} /> : page === "calculator" ? <Calculator size={15} /> : page === "cart" ? <ShoppingCart size={15} /> : page === "profile" ? <UserRound size={15} /> : <Settings size={15} />}{label}{page === "cart" && steamCartApps.length > 0 && <span className="nav-cart-count">{steamCartApps.length}</span>}</a>)}</nav>
        <div className="topbar-right">
          <button className="header-search-home" ref={headerSearchRef} onClick={() => navigateTo("home")} title="Go to Home" aria-label="Go to Home"><Search size={17} /><span>Search</span></button>
          <button className="theme-toggle" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button className={`avatar-button ${personalSteamProfileData?.profile ? (personalSteamProfileData.profile.currentGame ? "has-steam-game" : personalSteamProfileData.profile.online ? "is-steam-online" : "is-steam-offline") : ""}`} title={personalSteamProfileData?.profile?.currentGame ? `In game: ${personalSteamProfileData.profile.currentGame.name}` : personalSteamProfileData?.profile ? (personalSteamProfileData.profile.online ? "Online" : "Offline") : "Steam profile"} aria-label="Open Steam profile" onClick={() => navigateTo("profile")}>{personalSteamProfileData?.profile?.avatar ? <img className="avatar steam-avatar" src={personalSteamProfileData.profile.avatarAnimated || personalSteamProfileData.profile.avatar} alt="" /> : <span className="avatar"><UserRound size={19} /></span>}{personalSteamProfileData?.profile && <i className="header-steam-status-dot" aria-hidden="true" />}</button></div>
      </header>
  );
}
