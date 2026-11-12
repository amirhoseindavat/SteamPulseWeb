import {
	ExternalLink,
	Settings,
	RefreshCw,
	LoaderCircle,
	UserRound,
	Library,
	Clock3,
	Heart,
	Trophy,
	ShieldCheck,
	UsersRound,
	Gamepad2,
	Calculator,
} from "lucide-react";
import { formatNumber } from "../utils/formatters";

export default function ProfilePage({
	steamProfileData,
	steamProfileLoading,
	steamProfileError,
	steamAccountData,
	steamWishlist,
	isOwnSteamProfile,
	navigateTo,
	loadSteamProfile,
}) {
	return (
		<section className="steam-profile-page">
			{steamProfileData?.profile?.backgroundVideo ? (
				<video
					key={`${steamProfileData.profile.steamId}-${steamProfileData.profile.backgroundVideo}`}
					className="steam-profile-background-video"
					autoPlay
					muted
					loop
					playsInline
					poster={steamProfileData.profile.background || undefined}
					aria-hidden="true">
					<source
						src={steamProfileData.profile.backgroundVideo}
						type="video/webm"
					/>
				</video>
			) : steamProfileData?.profile?.background ? (
				<div
					key={`${steamProfileData.profile.steamId}-${steamProfileData.profile.background}`}
					className="steam-profile-background-image"
					style={{
						backgroundImage: `url("${steamProfileData.profile.background}")`,
					}}
					aria-hidden="true"
				/>
			) : null}
			{steamProfileLoading && (
				<div className="profile-loading detail-card">
					<LoaderCircle className="spin" size={22} /> Loading Steam profile…
				</div>
			)}
			{steamProfileError && !steamProfileLoading && (
				<div className="profile-error detail-card">
					<UserRound size={24} />
					<h2>Steam profile unavailable</h2>
					<p>{steamProfileError}</p>
					<button
						className="primary-button"
						onClick={() => navigateTo("settings")}>
						<Settings size={15} /> Open Settings
					</button>
					<button className="secondary-button" onClick={loadSteamProfile}>
						<RefreshCw size={15} /> Try again
					</button>
				</div>
			)}
			{steamProfileData && !steamProfileLoading && (
				<>
					<section className="steam-profile-hero detail-card">
						<div className="steam-profile-identity">
							<span className="steam-profile-avatar-wrap">
								<img
									className="steam-profile-avatar"
									src={
										steamProfileData.profile.avatarAnimated ||
										steamProfileData.profile.avatar
									}
									alt=""
								/>
								{steamProfileData.profile.avatarFrame && (
									<img
										className="steam-profile-avatar-frame"
										src={steamProfileData.profile.avatarFrame}
										alt=""
										aria-hidden="true"
									/>
								)}
							</span>
							<div className="steam-profile-name">
								<span className="section-kicker">
									<UserRound size={13} /> STEAM ACCOUNT
								</span>
								<div className="steam-profile-title-row">
									<h1>{steamProfileData.profile.name || "Steam user"}</h1>
									{(() => {
										const rawLevel = Number(steamProfileData.stats.level);
										const level =
											Number.isFinite(rawLevel) && rawLevel >= 0
												? Math.floor(rawLevel)
												: null;
										const shapes = [
											"hexagons",
											"shields",
											"books",
											"chevrons",
											"circles",
											"angles",
											"flags",
											"wings",
											"arrows",
											"crystals",
											"space",
											"water",
											"fire",
											"earth",
										];
										const colors = [
											"#8b929a",
											"#e35d5b",
											"#e58b45",
											"#e2c34c",
											"#80b95b",
											"#66a8d8",
											"#9274d8",
											"#d77bbd",
											"#9f5965",
											"#b58b5a",
										];
										const shape =
											level == null || level < 100
												? null
												: shapes[
														Math.min(
															shapes.length - 1,
															Math.floor(level / 100) - 1,
														)
													];
										const style =
											level == null
												? {}
												: level < 100
													? {
															"--steam-level-color":
																colors[Math.floor(level / 10)],
														}
													: {
															backgroundImage: `url(https://community.fastly.steamstatic.com/public/shared/images/community/levels_${shape}.png)`,
															backgroundPosition: `0 -${Math.floor((level % 100) / 10) * 42}px`,
														};
										return (
											<span
												className={`steam-level-frame steam-profile-level ${level != null && level >= 100 ? "is-sprite" : ""}`}
												style={style}>
												<span>{level == null ? "—" : formatNumber(level)}</span>
											</span>
										);
									})()}
								</div>
								<p>
									{steamProfileData.profile.realName ||
										"Steam community member"}
									{steamProfileData.profile.countryCode && (
										<>
											<span> · </span>
											<img
												className="steam-profile-country-flag"
												src={`https://flagcdn.com/w40/${steamProfileData.profile.countryCode.toLowerCase()}.png`}
												alt={steamProfileData.profile.country || "Country"}
												title={steamProfileData.profile.country || ""}
												loading="lazy"
											/>
										</>
									)}
								</p>
								{(() => {
									const status = String(
										steamProfileData.profile.status || "Offline",
									).toLowerCase();
									const isAway = status === "away" || status === "snooze";
									const statusClass = steamProfileData.profile.currentGame
										? "steam-in-game"
										: isAway
											? "steam-away"
											: steamProfileData.profile.online
												? "steam-online"
												: "steam-offline";
									return (
										<span className={statusClass}>
											<i aria-hidden="true" />
											{steamProfileData.profile.currentGame
												? "In-game"
												: steamProfileData.profile.status || "Offline"}
										</span>
									);
								})()}
							</div>
							<a
								className="profile-steam-link"
								href={steamProfileData.profile.url}
								target="_blank"
								rel="noreferrer">
								<ExternalLink size={15} /> View on Steam
							</a>
						</div>
						{steamProfileData.profile.summary && (
							<p className="steam-profile-summary">
								{steamProfileData.profile.summary}
							</p>
						)}
					</section>
					<section
						className={`profile-stats-grid ${isOwnSteamProfile ? "profile-stats-grid-own" : "profile-stats-grid-other"}`}>
						<div className="profile-stat detail-card">
							<div className="profile-stat-heading">
								<Library size={19} />
								<span>Games owned</span>
							</div>
							<div className="profile-stat-value">
								<strong>
									{steamProfileData.stats.games == null
										? "Private"
										: formatNumber(steamProfileData.stats.games)}
								</strong>
								{steamProfileData.gameCollector && (
									<img
										className="game-collector-inline-badge"
										src={steamProfileData.gameCollector.image}
										alt={`Game Collector Level ${steamProfileData.gameCollector.level}`}
										title={`Game Collector · Level ${formatNumber(steamProfileData.gameCollector.level)}`}
										loading="lazy"
									/>
								)}
							</div>
						</div>
						<div className="profile-stat detail-card">
							<div className="profile-stat-heading">
								<Clock3 size={19} />
								<span>Total playtime</span>
							</div>
							<strong className="profile-stat-value">
								{steamProfileData.stats.hours == null
									? "Private"
									: `${formatNumber(steamProfileData.stats.hours)} hrs`}
							</strong>
						</div>
						{isOwnSteamProfile &&
							Array.isArray(steamAccountData?.rgWishlist) && (
								<div className="profile-stat detail-card">
									<div className="profile-stat-heading">
										<Heart size={19} />
										<span>Wishlist</span>
									</div>
									<strong className="profile-stat-value">
										{formatNumber(steamWishlist.size)}
									</strong>
								</div>
							)}

						{steamProfileData.yearOfService && (
							<div className="profile-stat profile-badge-stat detail-card">
								<div className="profile-stat-heading">
									<Trophy size={19} />
									<span>Years of Service</span>
								</div>
								<span className="profile-badge-art">
									<img
										className="profile-badge-image"
										src={steamProfileData.yearOfService.image}
										alt="Years of Service badge"
										loading="lazy"
									/>
								</span>
							</div>
						)}
						<div className="profile-stat profile-badge-stat detail-card">
							<div className="profile-stat-heading">
								<Trophy size={19} />
								<span>Badges earned</span>
							</div>
							<strong className="profile-stat-value">
								{steamProfileData.stats.badges == null
									? "—"
									: formatNumber(steamProfileData.stats.badges)}
							</strong>
						</div>
					</section>
					<section className="detail-card profile-bans-card">
						<div className="card-title">
							<ShieldCheck size={18} />
							<h3>Account ban status</h3>
							<span
								style={{
									marginLeft: "auto",
									fontSize: 11,
									color: "var(--muted, #9aa3b2)",
								}}>
								STEAM PLAYER BANS
							</span>
						</div>
						{!steamProfileData.bans?.available ? (
							<p className="profile-muted">
								Ban information is currently unavailable from Steam. Try
								refreshing the profile in a moment.
							</p>
						) : (
							<>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
										gap: 10,
									}}>
									{[
										{
											label: "VAC status",
											value: steamProfileData.bans.vacBanned
												? "VAC banned"
												: "No VAC ban",
											flagged: steamProfileData.bans.vacBanned,
										},
										{
											label: "Game bans",
											value: steamProfileData.bans.numberOfGameBans
												? `${formatNumber(steamProfileData.bans.numberOfGameBans)} ban(s)`
												: "No game bans",
											flagged: steamProfileData.bans.numberOfGameBans > 0,
										},
										{
											label: "Community",
											value: steamProfileData.bans.communityBanned
												? "Community banned"
												: "No ban",
											flagged: steamProfileData.bans.communityBanned,
										},
										{
											label: "Trade",
											value:
												steamProfileData.bans.economyBan === "none"
													? "No ban"
													: steamProfileData.bans.economyBan,
											flagged: steamProfileData.bans.economyBan !== "none",
										},
									].map((item) => (
										<div
											key={item.label}
											style={{
												padding: "13px 14px",
												borderRadius: 12,
												border: "1px solid var(--border, rgba(255,255,255,.1))",
												background: "var(--surface-2, rgba(255,255,255,.035))",
											}}>
											<div
												style={{
													color: "var(--muted, #9aa3b2)",
													fontSize: 12,
													marginBottom: 7,
												}}>
												{item.label}
											</div>
											<strong
												style={{
													color: item.flagged ? "#ff7373" : "#65d6a1",
													fontSize: 14,
												}}>
												{item.value}
											</strong>
										</div>
									))}
								</div>
								<div
									style={{
										display: "flex",
										flexWrap: "wrap",
										gap: "8px 18px",
										marginTop: 13,
										color: "var(--muted, #9aa3b2)",
										fontSize: 12,
									}}>
									<span>
										{formatNumber(steamProfileData.bans.numberOfVACBans)} VAC
										ban(s)
									</span>
									<span>
										{steamProfileData.bans.daysSinceLastBan > 0
											? `Last ban ${formatNumber(steamProfileData.bans.daysSinceLastBan)} days ago`
											: "No previous ban date reported"}
									</span>
								</div>
							</>
						)}
					</section>
					{steamProfileData.profile.currentGame && (
						<section className="profile-current-game-section">
							<div className="detail-card profile-current-game">
								<div className="card-title">
									<Gamepad2 size={17} />
									<h3>Currently playing</h3>
									{steamProfileData.profile.currentGame && (
										<span className="current-game-live">
											<i /> IN-GAME
										</span>
									)}
								</div>
								{steamProfileData.profile.currentGame ? (
									<div className="current-game-content">
										{steamProfileData.profile.currentGame.appid && (
											<a
												className="current-game-art"
												href={`https://store.steampowered.com/app/${steamProfileData.profile.currentGame.appid}/`}
												target="_blank"
												rel="noreferrer">
												<img
													src={
														steamProfileData.profile.currentGame.image ||
														`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamProfileData.profile.currentGame.appid}/header.jpg`
													}
													alt={`${steamProfileData.profile.currentGame.name} cover`}
													loading="lazy"
													onError={(event) => {
														const img = event.currentTarget;
														const appId =
															steamProfileData.profile.currentGame.appid;
														const fallbacks = [
															`https://cdn.cloudflare.steamstatic.com/steam/apps/${steamProfileData.profile.currentGame.appid}/header.jpg`,
															`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamProfileData.profile.currentGame.appid}/header.jpg`,
															`https://cdn.akamai.steamstatic.com/steam/apps/${steamProfileData.profile.currentGame.appid}/header.jpg`,
														];
														const next = fallbacks.shift();
														if (next) {
															img.onerror = () => {
																const following = fallbacks.shift();
																if (following) img.src = following;
																else {
																	img.onerror = null;
																	img.style.visibility = "hidden";
																	img.parentElement.classList.add(
																		"current-game-no-art",
																	);
																}
															};
															img.src = next;
														} else {
															img.onerror = null;
															img.style.visibility = "hidden";
															img.parentElement.classList.add(
																"current-game-no-art",
															);
														}
													}}
												/>
											</a>
										)}
										<span className="current-game-copy">
											<strong>
												{steamProfileData.profile.currentGame.name}
											</strong>
											<small>Playing right now</small>
										</span>
										{steamProfileData.profile.currentGame.appid && (
											<a
												className="current-game-open"
												href={`https://store.steampowered.com/app/${steamProfileData.profile.currentGame.appid}/`}
												target="_blank"
												rel="noreferrer"
												aria-label="Open game on Steam">
												<ExternalLink size={15} />
											</a>
										)}
									</div>
								) : null}
							</div>
						</section>
					)}
					<section className="profile-content-grid">
						<div className="detail-card profile-recent">
							<div className="card-title">
								<Clock3 size={17} />
								<h3>Recently played</h3>
							</div>
							{steamProfileData.recentGames.length ? (
								steamProfileData.recentGames.map((item) => (
									<a
										className="recent-game-row"
										key={item.appid}
										href={`https://store.steampowered.com/app/${item.appid}/`}
										target="_blank"
										rel="noreferrer">
										<img
											src={
												item.image ||
												`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.appid}/header.jpg`
											}
											alt=""
											loading="lazy"
											onError={(event) => {
												event.currentTarget.style.visibility = "hidden";
												event.currentTarget.parentElement.classList.add(
													"recent-game-no-capsule",
												);
											}}
										/>
										<span>
											{item.name}
											<small>
												{formatNumber(item.hours2Weeks)} hrs in last 2 weeks ·{" "}
												{formatNumber(item.hours)} hrs total
											</small>
										</span>
										<ExternalLink size={14} />
									</a>
								))
							) : (
								<p className="profile-muted">
									No recent games available, or the profile's game details are
									private.
								</p>
							)}
						</div>
						<div className="detail-card profile-account">
							<div className="card-title">
								<UsersRound size={17} />
								<h3>Account details</h3>
							</div>
							<dl>
								<div>
									<dt>SteamID64</dt>
									<dd>{steamProfileData.profile.steamId}</dd>
								</div>
								<div>
									<dt>AccountID</dt>
									<dd>
										{steamProfileData.profile.accountId ||
											(
												BigInt(steamProfileData.profile.steamId) -
												76561197960265728n
											).toString()}
									</dd>
								</div>
								<div>
									<dt>Account created</dt>
									<dd>{steamProfileData.profile.created || "Not public"}</dd>
								</div>
								<div>
									<dt>Last online</dt>
									<dd>
										{steamProfileData.profile.lastLogoff || "Not available"}
									</dd>
								</div>
								<div>
									<dt>Profile visibility</dt>
									<dd>{steamProfileData.profile.visibility || "Unknown"}</dd>
								</div>
								<div>
									<dt>Friends count</dt>
									<dd>
										{steamProfileData.stats.friends == null
											? "Private / unavailable"
											: formatNumber(steamProfileData.stats.friends)}
									</dd>
								</div>
							</dl>
							<div className="profile-external-links">
								<a
									href={steamProfileData.profile.url}
									target="_blank"
									rel="noreferrer">
									<img
										src="https://www.google.com/s2/favicons?domain=steamcommunity.com&sz=32"
										alt=""
									/>
									Steam Profile <ExternalLink size={13} />
								</a>
								<a
									href={`https://steamdb.info/calculator/${steamProfileData.profile.steamId}/`}
									target="_blank"
									rel="noreferrer">
									<img
										src="https://www.google.com/s2/favicons?domain=steamdb.info&sz=32"
										alt=""
									/>
									SteamDB Calculator <ExternalLink size={13} />
								</a>
								<a
									href={`https://steamladder.com/profile/${steamProfileData.profile.steamId}/`}
									target="_blank"
									rel="noreferrer">
									<img
										src="https://www.google.com/s2/favicons?domain=steamladder.com&sz=32"
										alt=""
									/>
									Steam Ladder <ExternalLink size={13} />
								</a>
								<a
									href={`https://steamrep.com/profiles/${steamProfileData.profile.steamId}`}
									target="_blank"
									rel="noreferrer">
									<img
										src="https://www.google.com/s2/favicons?domain=steamrep.com&sz=32"
										alt=""
									/>
									SteamRep <ExternalLink size={13} />
								</a>
								<a
									href={`https://steamid.io/lookup/${steamProfileData.profile.steamId}`}
									target="_blank"
									rel="noreferrer">
									<img
										src="https://www.google.com/s2/favicons?domain=steamid.io&sz=32"
										alt=""
									/>
									SteamID.io <ExternalLink size={13} />
								</a>
							</div>
						</div>
					</section>
				</>
			)}
		</section>
	);
}
