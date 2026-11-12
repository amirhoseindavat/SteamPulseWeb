import { Info, Mail, Send, Github, Globe2, ExternalLink } from "lucide-react";

const links = [
  { label: "Email", value: "Info@CodeMage.ir", href: "mailto:Info@CodeMage.ir", Icon: Mail },
  { label: "Telegram", value: "@Steampulse", href: "https://t.me/Steampulse", Icon: Send },
  { label: "GitHub", value: "SteamPulse on GitHub", href: "https://github.com/amirhoseindavat/SteamPulseWeb", Icon: Github },
  { label: "SteamPulse Web", value: "steampulse.ir", href: "https://steampulse.ir/", Icon: Globe2 },
];

export default function AboutPage({ version = "v4.0.0" }) {
  return (
    <section className="about-page detail-card">
      <div className="about-page-heading">
        <span className="section-kicker"><Info size={14} /> ABOUT STEAMPULSE</span>
        <h1>About SteamPulse</h1>
        <p className="about-page-lead">
          SteamPulse is a free and open-source project built to make exploring
          Steam games and making smarter purchasing decisions easier.
        </p>
      </div>

      <div className="about-page-copy">
        <p>
          SteamPulse is a free and open-source software that accesses
          information about games on Steam using the Steam Web API and helps
          gamers make informed decisions when purchasing games with keys.
        </p>
        <p>
          SteamPulse is the result of a year of effort by the CodeMage team.
          During this time, we received positive feedback from users and
          worked to fix reported issues. We hope SteamPulse provides a smooth
          and reliable experience.
        </p>
      </div>

      <div className="about-page-links">
        {links.map(({ label, value, href, Icon }) => (
          <a key={label} href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">
            <span className="about-page-link-icon"><Icon size={18} /></span>
            <span className="about-page-link-copy">
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
            <ExternalLink size={14} className="about-page-external" />
          </a>
        ))}
      </div>

      <div className="about-page-bottom">
        <span>SteamPulse <strong>{version}</strong></span>
        <span>Developed with care by <a href="https://codemage.ir/" target="_blank" rel="noreferrer">CodeMage</a></span>
      </div>
    </section>
  );
}
