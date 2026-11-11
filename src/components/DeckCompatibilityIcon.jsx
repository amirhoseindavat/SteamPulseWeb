function DeckCompatibilityIcon({ status, size = 18 }) {
	const icons = {
		verified:
			"https://cdn.steamstatic.com/steamcommunity/public/images/steamworks_docs/english/verified_18.png",
		playable:
			"https://cdn.steamstatic.com/steamcommunity/public/images/steamworks_docs/english/playable_18.png",
		unsupported:
			"https://cdn.steamstatic.com/steamcommunity/public/images/steamworks_docs/english/unsupported_18.png",
		unknown:
			"https://cdn.steamstatic.com/steamcommunity/public/images/steamworks_docs/english/unknown_18.png",
	};
	return (
		<img
			className="steam-deck-rating-icon"
			src={icons[status] || icons.unknown}
			width={size}
			height={size}
			alt=""
		/>
	);
}
export default DeckCompatibilityIcon;
