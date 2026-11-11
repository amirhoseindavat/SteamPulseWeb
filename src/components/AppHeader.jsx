import { useEffect, useRef, useState } from "react";
import {
  Search, Activity, Gamepad2, Tag, Calculator, ShoppingCart,
  UserRound, Settings, Sun, Moon, CalendarDays, ChevronDown
} from "lucide-react";

export default function AppHeader({
  currentPage, navigateTo, steamCartApps, headerSearchRef, theme,
  setTheme, personalSteamProfileData,
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  const menuItems = [
    { page: "cart", label: "Cart", Icon: ShoppingCart, count: steamCartApps.length },
    { page: "settings", label: "Settings", Icon: Settings },
  ];

  return (
    <header className="topbar">
      <nav className="main-nav" aria-label="Main navigation">
        {[
          ["home", "Home"],
          ["games", "Games"],
          ["market", "Market"],
          ["sales", "Sales"],
          ["calculator", "Calculator"],
        ].map(([page, label]) => (
          <a
            key={page}
            href={page === "games" ? "#/games/freegames" : `#/${page}`}
            className={currentPage === page || (currentPage === "game" && page === "games") ? "active" : ""}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              navigateTo(page);
            }}
          >
            {page === "home" ? <Activity size={15} /> :
             page === "games" ? <Gamepad2 size={15} /> :
             page === "market" ? <Tag size={15} /> :
             page === "sales" ? <CalendarDays size={15} /> :
             <Calculator size={15} />}
            {label}
          </a>
        ))}
      </nav>

      <div className="topbar-right">
        <button
          className="header-search-home"
          ref={headerSearchRef}
          onClick={() => navigateTo("home")}
          title="Go to Home"
          aria-label="Go to Home"
        >
          <Search size={17} /><span>Search</span>
        </button>
        <button
          className="theme-toggle"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div
          className="header-profile-menu"
          ref={profileMenuRef}
          onMouseEnter={() => setProfileMenuOpen(true)}
          onMouseLeave={() => setProfileMenuOpen(false)}
        >
          <div className="header-profile-trigger-row">
            <a
              className={`avatar-button ${personalSteamProfileData?.profile ? (personalSteamProfileData.profile.currentGame ? "has-steam-game" : personalSteamProfileData.profile.online ? "is-steam-online" : "is-steam-offline") : ""}`}
              href="#/profile"
              target="_blank"
              rel="noopener noreferrer"
              title="Open SteamPulse profile in a new tab"
              aria-label="Open SteamPulse profile in a new tab"
            >
              {personalSteamProfileData?.profile?.avatar ? (
                <img
                  className="avatar steam-avatar"
                  src={personalSteamProfileData.profile.avatarAnimated || personalSteamProfileData.profile.avatar}
                  alt=""
                />
              ) : (
                <span className="avatar"><UserRound size={19} /></span>
              )}
              {personalSteamProfileData?.profile && <i className="header-steam-status-dot" aria-hidden="true" />}
            </a>
            <button
              className={`profile-menu-toggle ${profileMenuOpen ? "is-open" : ""}`}
              type="button"
              aria-label="Open profile menu"
              aria-expanded={profileMenuOpen}
              onClick={() => setProfileMenuOpen((open) => !open)}
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {profileMenuOpen && (
            <div className="profile-dropdown glass-panel" role="menu" aria-label="Profile menu">
              <div className="profile-dropdown-heading">Quick access</div>
              {menuItems.map(({ page, label, Icon, count }) => (
                <button
                  key={page}
                  type="button"
                  role="menuitem"
                  className={`profile-dropdown-item ${currentPage === page ? "active" : ""}`}
                  onClick={() => {
                    setProfileMenuOpen(false);
                    navigateTo(page);
                  }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {count > 0 && <span className="profile-dropdown-count">{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
