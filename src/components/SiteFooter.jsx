export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand-group">
        <img className="site-footer-logo" src="https://steampulse.ir/favicon.png" alt="" loading="lazy" />
        <span className="site-footer-brand">SteamPulse</span>
        <span className="site-footer-version">v1.0</span>
      </div>
      <span className="site-footer-credit">Made with <span aria-label="love">❤️</span> by <img src="https://codemage.ir/img/favicon.png" alt="CodeMage" loading="lazy" /><a href="https://codemage.ir/" target="_blank" rel="noreferrer">CodeMage</a></span>
      <span className="site-footer-copyright">© All rights reserved</span>
    </footer>
  );
}
