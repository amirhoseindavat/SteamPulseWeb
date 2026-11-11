function SteamDeckMark({ size = 18 }) {
	return (
		<svg
			className="steam-deck-mark"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			aria-hidden="true">
			<path
				fill="currentColor"
				d="M7.777 4.302a5.698 5.698 0 1 1 0 11.396v3.19a8.889 8.889 0 1 0 0-17.777v3.191Zm0 9.587a3.889 3.889 0 1 0 0-7.778 3.889 3.889 0 0 0 0 7.778Z"
			/>
		</svg>
	);
}
export default SteamDeckMark;
