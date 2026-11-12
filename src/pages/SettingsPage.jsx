import {
	Settings,
	Globe2,
	Users,
	Save,
	CheckCircle2,
	ShieldCheck,
	ExternalLink,
} from "lucide-react";
import RegionSelect from "../components/RegionSelect";

export default function SettingsPage({
	region,
	setRegion,
	steamProfileDraft,
	setSteamProfileDraft,
	saveSettings,
	steamProfile,
	steamApiKeyDraft,
	setSteamApiKeyDraft,
}) {
	return (
		<section className="settings-page detail-card">
			<div className="settings-heading">
				<span className="section-kicker">
					<Settings size={13} /> PERSONAL PREFERENCES
				</span>
				<h1>Settings</h1>
				<p>
					Save your default Steam price region and profile for quick library
					checks.
				</p>
			</div>
			<div className="settings-form">
				<label>
					<span>
						<Globe2 size={16} /> Default price region
					</span>
					<RegionSelect value={region} onChange={setRegion} />
					<small>
						This region is remembered in this browser and used for future game
						lookups.
					</small>
				</label>
				<label>
					<span>
						<Users size={16} /> Steam profile URL or SteamID64
					</span>
					<input
						value={steamProfileDraft}
						onChange={(e) => setSteamProfileDraft(e.target.value)}
						placeholder="https://steamcommunity.com/profiles/7656… or /id/username"
					/>
					<small>
						Your profile and owned games must be public for library checks.
					</small>
				</label>
				<button className="primary-button" onClick={saveSettings}>
					<Save size={16} /> Save settings
				</button>
				{steamProfile && (
					<p className="settings-saved">
						<CheckCircle2 size={15} /> Steam profile saved in this browser.
					</p>
				)}
			</div>
			<div className="settings-form api-key-settings">
				<label>
					<span>
						<ShieldCheck size={16} /> Your Steam Web API Key
					</span>
					<input
						type="password"
						autoComplete="off"
						value={steamApiKeyDraft}
						onChange={(e) => setSteamApiKeyDraft(e.target.value)}
						placeholder="Paste your Steam Web API key"
					/>
					<small>
						Your key is saved only in this browser and sent to the SteamPulse
						server when you request Steam account data. Never share it with
						anyone.
					</small>
				</label>
				<div className="api-key-guide">
					<strong>How to get your key</strong>
					<ol>
						<li>
							Open the official Steam API key page and sign in to your Steam
							account.
						</li>
						<li>
							Enter a domain name if Steam asks, then accept the terms and
							register.
						</li>
						<li>Copy the key shown by Steam and paste it above.</li>
					</ol>
					<a
						href="https://steamcommunity.com/dev/apikey"
						target="_blank"
						rel="noreferrer">
						<ExternalLink size={14} /> Get your Steam Web API Key
					</a>
				</div>
			</div>
			<div className="settings-note">
				<ShieldCheck size={18} />
				<div>
					<strong>About ownership checks</strong>
					<p>
						Your personal key is used for profile statistics and library checks.
						Steam may not expose every DLC as a separate owned app, so DLC
						results are best-effort, not a purchase receipt. You can remove the
						key from this field and save settings to clear it from this browser.
					</p>
				</div>
			</div>
		</section>
	);
}
