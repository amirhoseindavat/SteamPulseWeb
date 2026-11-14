import { ExternalLink, Save, Tag, ChevronRight, Globe2 } from "lucide-react";
import RegionSelect from "./RegionSelect";
import { formatNumber } from "../utils/formatters";

export default function GamePurchasePanel({
	hasStorePrice,
	game,
	hasEditions,
	hasBundles,
	gameEditions,
	gameBundles,
	missingPackages,
	steamAccountConnected,
	steamOwnedPackages,
	purchaseTab,
	setPurchaseTab,
	selectedEditionName,
	setSelectedEditionName,
	setRegionalPriceInput,
	calculatorRef,
	region,
	setRegion,
	selectedRegion,
	regionalPriceInput,
	numericRegionalPrice,
	regionalKeyPriceForCalculation,
	keyCount,
	totalToman,
	liveKeyPriceToman,
	shopDataError,
	regionalKeyPrice,
}) {
	const showOwnership =
		game && String(game.type || "").toLowerCase() !== "hardware";
	if (!hasStorePrice) return null;

	const packageEditions = (gameEditions || []).filter(
		(edition) => String(edition.kind || "").toLowerCase() === "default",
	);

	const otherItems = (gameEditions || []).filter(
		(edition) => String(edition.kind || "").toLowerCase() !== "default",
	);

	const getOtherItemLabel = (kind) => {
		const value = String(kind || "").toLowerCase();

		if (value.includes("subscription")) return "Subscriptions";
		if (value.includes("fc point")) return "FC Points";
		if (value.includes("call of duty") || value.includes("cod point")) {
			return "COD Points";
		}

		return String(kind || "Other")
			.replace(/[_-]+/g, " ")
			.replace(/\b\w/g, (char) => char.toUpperCase());
	};

	const otherTabLabels = [
		...new Set(otherItems.map((item) => getOtherItemLabel(item.kind))),
	];

	const otherTabLabel =
		otherTabLabels.length > 0 ? otherTabLabels.join(" / ") : "Other";

	const visibleEditions =
		purchaseTab === "other" ? otherItems : packageEditions;

	const availablePurchaseTabs = [
		...(packageEditions.length > 0 || missingPackages.length > 0
			? ["editions"]
			: []),
		...(gameBundles.length > 0 ? ["bundles"] : []),
		...(otherItems.length > 0 ? ["other"] : []),
	];

	const activePurchaseTab = availablePurchaseTabs.includes(purchaseTab)
		? purchaseTab
		: availablePurchaseTabs[0] || "editions";

	return (
		<div className="purchase-layout">
			<div className="purchase-options-column">
				{game.type !== "edition" &&
					((game.editions || []).length > 0 ||
						(game.bundles || []).length > 0) && (
						<section className="extra-content-section purchase-options-panel">
							<div className="detail-header">
								<div>
									<span className="section-kicker">PURCHASE OPTIONS</span>
									<h2>Choose your Edition</h2>
									<p className="purchase-hint">
										Select an edition or bundle to calculate its required keys
										and estimated cost.
									</p>
								</div>
							</div>
							{availablePurchaseTabs.length > 1 && (
								<div
									className="purchase-tabs"
									role="tablist"
									aria-label="Purchase options">
									{availablePurchaseTabs.includes("editions") && (
										<button
											type="button"
											role="tab"
											aria-selected={activePurchaseTab === "editions"}
											className={
												activePurchaseTab === "editions"
													? "purchase-tab-active"
													: ""
											}
											onClick={() => setPurchaseTab("editions")}>
											Packages
											<span>
												{packageEditions.length + missingPackages.length}
											</span>
										</button>
									)}

									{availablePurchaseTabs.includes("bundles") && (
										<button
											type="button"
											role="tab"
											aria-selected={activePurchaseTab === "bundles"}
											className={
												activePurchaseTab === "bundles"
													? "purchase-tab-active"
													: ""
											}
											onClick={() => setPurchaseTab("bundles")}>
											Bundles
											<span>{gameBundles.length}</span>
										</button>
									)}

									{availablePurchaseTabs.includes("other") && (
										<button
											type="button"
											role="tab"
											aria-selected={activePurchaseTab === "other"}
											className={
												activePurchaseTab === "other"
													? "purchase-tab-active"
													: ""
											}
											onClick={() => setPurchaseTab("other")}>
											{otherTabLabel}
											<span>{otherItems.length}</span>
										</button>
									)}
								</div>
							)}
							{(purchaseTab === "editions" || purchaseTab === "other") && (
								<div className="editions-grid purchase-editions-grid">
									{visibleEditions.map((edition, i) => (
										<article
											className={`edition-card ${showOwnership && steamAccountConnected && edition.packageId != null && steamOwnedPackages.has(Number(edition.packageId)) ? "edition-card-owned" : ""} ${selectedEditionName === (edition.name || "").replace(/\s*-\s*\$\s*$/, "") ? "edition-card-selected" : ""}`}
											key={`${edition.packageId || edition.name}-${i}`}>
											<button
												className="edition-select"
												onClick={() => {
													if (edition.priceValue != null) {
														setRegionalPriceInput(String(edition.priceValue));
														setSelectedEditionName(
															(edition.name || "").replace(/\s*-\s*\$\s*$/, ""),
														);
														calculatorRef.current?.scrollIntoView({
															behavior: "smooth",
															block: "center",
														});
													}
												}}
												disabled={edition.priceValue == null}
												title={
													edition.priceValue == null
														? "Price unavailable for calculation"
														: "Calculate required keys for this option"
												}>
												<div className="edition-top">
													<span className="edition-tag">
														{String(edition.kind || "").toLowerCase() ===
														"default"
															? "EDITION"
															: edition.kind || "STEAM EDITION"}
													</span>
													<span className="edition-top-status">
														{showOwnership
															? steamAccountConnected
																? edition.packageId == null
																	? ""
																	: steamOwnedPackages.has(
																				Number(edition.packageId),
																		  )
																		? "✓ Owned"
																		: ""
																: ""
															: ""}
													</span>
													{edition.savings && Number(edition.savings) > 0 && (
														<span className="edition-discount">
															-{edition.savings}%
														</span>
													)}
												</div>
												<span className="edition-package-id">
													PACKAGE · {edition.packageId ?? "ID unavailable"}
												</span>
												<h3>
													{(edition.name || "").replace(/\s*-\s*\$\s*$/, "")}
												</h3>
												<p>{edition.description || "Steam purchase option"}</p>
												<div className="edition-bottom">
													<div className="edition-prices">
														{edition.originalPrice &&
															edition.savings &&
															Number(edition.savings) > 0 && (
																<del>{edition.originalPrice}</del>
															)}
														<strong>
															{edition.price || "Price unavailable"}
														</strong>
													</div>
													{edition.savings && Number(edition.savings) > 0 && (
														<span className="edition-save-label">
															Save {edition.savings}%
														</span>
													)}
												</div>
												<span className="edition-calculate">
													{edition.priceValue != null
														? "Calculate keys"
														: "Price unavailable"}{" "}
													<ChevronRight size={13} />
												</span>
											</button>
											{edition.url && (
												<a
													className="edition-external-link"
													href={edition.url}
													target="_blank"
													rel="noreferrer">
													View on Steam <ExternalLink size={13} />
												</a>
											)}
										</article>
									))}
									{missingPackages.map((edition) => (
										<article
											className={`edition-card ${showOwnership && steamOwnedPackages.has(edition.packageId) ? "edition-card-owned" : ""}`}
											key={edition.packageId}>
											<div className="edition-top">
												<span className="edition-tag">STEAM PACKAGE</span>
												<span className="edition-top-status">
													{showOwnership
														? steamAccountConnected
															? steamOwnedPackages.has(edition.packageId)
																? "✓ Owned"
																: ""
															: "Ownership unavailable"
														: ""}
												</span>
											</div>
											<span className="edition-package-id">
												PACKAGE · {edition.packageId}
											</span>
											<h3>{edition.name}</h3>
											<p>{edition.description}</p>
											<div className="edition-bottom">
												<div className="edition-prices">
													<strong>
														{showOwnership &&
														steamOwnedPackages.has(edition.packageId)
															? "Owned"
															: "Package details unavailable"}
													</strong>
												</div>
											</div>
											<a
												className="edition-external-link"
												href={edition.url}
												target="_blank"
												rel="noreferrer">
												View on Steam <ExternalLink size={13} />
											</a>
										</article>
									))}
								</div>
							)}
							{purchaseTab === "bundles" && (
								<div className="bundle-list">
									{(game.bundles || []).length ? (
										game.bundles.map((bundle) => (
											<article
												className={`bundle-row ${selectedEditionName === (bundle.name || "").replace(/\s*-\s*\$\s*$/, "") ? "edition-card-selected" : ""}`}
												key={bundle.id}>
												<button
													className="bundle-select"
													onClick={() => {
														if (bundle.priceValue != null) {
															setRegionalPriceInput(String(bundle.priceValue));
															setSelectedEditionName(
																(bundle.name || "").replace(
																	/\s*-\s*\$\s*$/,
																	"",
																),
															);
															calculatorRef.current?.scrollIntoView({
																behavior: "smooth",
																block: "center",
															});
														}
													}}
													disabled={bundle.priceValue == null}
													title={
														bundle.priceValue == null
															? "Price unavailable for calculation"
															: "Calculate required keys for this bundle"
													}>
													<span
														className={`bundle-thumb ${bundle.image ? "" : "bundle-thumb-empty"}`}>
														{bundle.image ? (
															<img
																src={bundle.image}
																alt=""
																loading="lazy"
																onError={(event) => {
																	event.currentTarget.style.display = "none";
																	event.currentTarget.parentElement.classList.add(
																		"bundle-thumb-empty",
																	);
																}}
															/>
														) : (
															<Tag size={18} />
														)}
													</span>
													<span className="bundle-copy">
														<strong>
															{(bundle.name || "").replace(/\s*-\s*\$\s*$/, "")}
														</strong>
														<small>
															{bundle.appCount
																? `Includes ${bundle.appCount} games or items, including this title`
																: "Steam bundle featuring this title"}
														</small>
														<span className="bundle-price">
															{bundle.originalPrice &&
																bundle.originalPrice !== bundle.price && (
																	<del>{bundle.originalPrice}</del>
																)}
															<b>{bundle.price || "Price unavailable"}</b>
															{Number(bundle.savings) > 0 && (
																<span className="dlc-discount-badge">
																	-{bundle.savings}%
																</span>
															)}
														</span>
													</span>
													<span className="bundle-calculate">
														{bundle.priceValue != null
															? "Calculate keys"
															: "Unavailable"}{" "}
														<ChevronRight size={14} />
													</span>
												</button>
												<a
													className="bundle-store-link"
													href={bundle.url}
													target="_blank"
													rel="noreferrer"
													aria-label={`View ${bundle.name} on Steam`}>
													<ExternalLink size={14} />
												</a>
											</article>
										))
									) : (
										<div className="purchase-empty-state">
											No Steam bundles found for this game.
										</div>
									)}
								</div>
							)}
						</section>
					)}
			</div>
			<section className="key-calculator detail-card" ref={calculatorRef}>
				<div className="calculator-heading">
					<div>
						<span className="section-kicker">KEY COST ESTIMATOR</span>
						<h2>Calculate your key cost</h2>
						<p>
							Choose the Steam region and price to estimate how many keys you
							need and the total cost.
						</p>
					</div>
					<div className="calculator-icon">
						<Tag size={21} />
					</div>
				</div>
				<label className="calculator-region">
					<span>
						<Globe2 size={15} /> Steam price region
					</span>
					<RegionSelect
						value={region}
						onChange={(nextRegion) => {
							setRegion(nextRegion);
							localStorage.setItem("steampulse-region", nextRegion);
						}}
					/>
				</label>
				<div className="calculator-content">
					<div className="calculator-result usd-price-display">
						<small>STEAM PRICE</small>
						<strong>
							{regionalPriceInput.trim() !== "" &&
							Number.isFinite(numericRegionalPrice)
								? formatNumber(numericRegionalPrice)
								: "—"}{" "}
							<span>{selectedRegion.currency}</span>
						</strong>
						<p>Steam store price · {selectedRegion.label}</p>
					</div>
					<div className="calculator-result">
						<small>KEYS REQUIRED</small>
						<strong>
							{keyCount ? formatNumber(keyCount) : "—"} <span>Keys</span>
						</strong>
						<p>
							{keyCount && regionalKeyPriceForCalculation > 0
								? `${keyCount} × ${formatNumber(regionalKeyPriceForCalculation)} ${selectedRegion.currency} net/key`
								: regionalKeyPrice?.error ||
									"Loading live Steam key price for this region…"}
						</p>
					</div>
					<div className="calculator-result cost-result">
						<small>ESTIMATED COST</small>
						<strong>
							{keyCount ? formatNumber(totalToman) : "—"} <span>toman</span>
						</strong>
						<p>
							{keyCount && liveKeyPriceToman > 0
								? `${keyCount} × ${formatNumber(liveKeyPriceToman)} toman`
								: shopDataError ||
									regionalKeyPrice?.error ||
									"Loading live shop key price…"}
						</p>
					</div>
				</div>
			</section>
		</div>
	);
}
