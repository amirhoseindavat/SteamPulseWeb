function decodeSteamHtml(value = "") {
	return String(value)
		.replace(/<[^>]*>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, " ")
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
			String.fromCodePoint(parseInt(code, 16)),
		)
		.replace(/\s+/g, " ")
		.trim();
}

export { decodeSteamHtml };
