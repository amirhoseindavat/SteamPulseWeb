export default function SiteFooter({ navigateTo, version = "v4.0.0" }) {
	return (
		<footer className="site-footer">
			<div className="site-footer-brand-group">
				<a
					className="site-footer-brand-link"
					href="/about"
					aria-label="About SteamPulse"
					onClick={(event) => {
						if (
							event.button !== 0 ||
							event.metaKey ||
							event.ctrlKey ||
							event.shiftKey ||
							event.altKey
						)
							return;
						event.preventDefault();
						navigateTo?.("about");
					}}>
					<img
						className="site-footer-logo"
						src="https://steampulse.ir/favicon.png"
						alt=""
						loading="lazy"
					/>
					<span className="site-footer-brand">SteamPulse</span>
				</a>
				<span className="site-footer-version">{version}</span>
			</div>
			<span className="site-footer-credit">
				Made with <span aria-label="love">❤️</span> by{" "}
				<img
					src="https://codemage.ir/img/favicon.png"
					alt="CodeMage"
					loading="lazy"
				/>
				<a href="https://codemage.ir/" target="_blank" rel="noreferrer">
					CodeMage
				</a>
			</span>
			<span className="site-footer-copyright">© All rights reserved</span>
		</footer>
	);
}
