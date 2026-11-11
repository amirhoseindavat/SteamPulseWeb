import { ExternalLink } from "lucide-react";

export default function GameNewsSection({ activeTab, game, hero }) {
	if (activeTab !== "steam news" && activeTab !== "external news") return null;

	const isSteamNews = activeTab === "steam news";
	const items = isSteamNews ? game.news || [] : game.external_news || [];

	return (
		<div className="game-news-grid">
			{items.length ? (
				items.map((item, i) => (
					<article className="game-news-card" key={item.gid || i}>
						{isSteamNews &&
							(item.image ||
								game.header_image ||
								game.header_image_2x ||
								hero) && (
								<a
									className="game-news-image"
									href={item.url}
									target="_blank"
									rel="noreferrer">
									<img
										src={
											item.image ||
											game.header_image ||
											game.header_image_2x ||
											hero
										}
										loading="lazy"
										alt={item.image ? "" : game.name}
									/>
								</a>
							)}
						<div className="game-news-body">
							<div className="game-news-meta">
								<span>
									{item.feedlabel ||
										(isSteamNews ? "STEAM NEWS" : "EXTERNAL NEWS")}
								</span>
								<time>
									{item.date
										? new Date(item.date * 1000).toLocaleDateString()
										: ""}
								</time>
							</div>
							<h3>{item.title}</h3>
							<p>
								{item.contents || "Open the article to read the full update."}
							</p>
							<a href={item.url} target="_blank" rel="noreferrer">
								{isSteamNews ? "Read on Steam" : "Read article"}{" "}
								<ExternalLink size={13} />
							</a>
						</div>
					</article>
				))
			) : (
				<div className="empty-card">
					No recent {isSteamNews ? "Steam" : "external"} news is available for
					this title.
				</div>
			)}
		</div>
	);
}
