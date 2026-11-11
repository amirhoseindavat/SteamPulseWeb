import { Calculator, Globe2, Info } from "lucide-react";
import RegionSelect from "../components/RegionSelect";
import { formatNumber } from "../utils/formatters";

export default function CalculatorPage({
	region,
	setRegion,
	conversionMode,
	setConversionMode,
	conversionAmount,
	setConversionAmount,
	selectedRegion,
	conversionResult,
	conversionResultFormatted,
	conversionResultLabel,
	regionalKeyPrice,
	regionalKeyPriceForCalculation,
	liveKeyPriceToman,
	shopDataError,
}) {
	return (
		<section className="conversion-page">
			<div className="conversion-heading">
				<div>
					<span className="section-kicker">
						<Calculator size={13} /> STEAMPULSE CONVERTER
					</span>
					<h1>Key calculator</h1>
					<p>
						Convert between Steam regional prices, TF2 keys and your local shop
						price using live data.
					</p>
				</div>
				<span className="conversion-live">
					<i /> LIVE RATES
				</span>
			</div>
			<section className="conversion-card detail-card">
				<label className="conversion-region">
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
				<div className="conversion-mode-grid">
					{[
						["currency-to-keys", "Currency to keys", "18 USD → keys"],
						["toman-to-keys", "Toman to keys", "800,000 toman → keys"],
						["keys-to-toman", "Keys to toman", "5 keys → toman"],
						["keys-to-currency", "Keys to currency", "5 keys → USD"],
					].map(([mode, label, hint]) => (
						<button
							type="button"
							key={mode}
							className={conversionMode === mode ? "active" : ""}
							onClick={() => {
								setConversionMode(mode);
								setConversionAmount(
									mode === "currency-to-keys"
										? "18"
										: mode === "toman-to-keys"
											? "800000"
											: "5",
								);
							}}>
							<strong>{label}</strong>
							<small>{hint}</small>
						</button>
					))}
				</div>
				<label className="conversion-input">
					<span>
						{conversionMode === "currency-to-keys"
							? "Amount (" + selectedRegion.currency + ")"
							: conversionMode === "toman-to-keys"
								? "Amount (toman)"
								: "Number of keys"}
					</span>
					<div>
						<input
							type="number"
							min="0"
							step="any"
							value={conversionAmount}
							onChange={(e) => setConversionAmount(e.target.value)}
							placeholder="Enter amount"
						/>
						<b>
							{conversionMode === "currency-to-keys"
								? selectedRegion.currency
								: conversionMode === "toman-to-keys" ||
									  conversionMode === "keys-to-toman"
									? "TOMAN"
									: "KEYS"}
						</b>
					</div>
				</label>
				<div className="conversion-result">
					<span>CONVERTED VALUE</span>
					{conversionResult == null ? (
						<strong>—</strong>
					) : (
						<>
							<strong>
								{conversionResultFormatted}{" "}
								<small>{conversionResultLabel}</small>
							</strong>
							{(conversionMode === "currency-to-keys" ||
								conversionMode === "toman-to-keys") && (
								<p>
									For a whole-key purchase:{" "}
									<b>{formatNumber(Math.ceil(conversionResult))} keys</b>
								</p>
							)}
						</>
					)}
					{conversionResult == null && (
						<p>
							{conversionMode === "currency-to-keys" ||
							conversionMode === "keys-to-currency"
								? regionalKeyPrice?.error || "Loading regional Steam key price…"
								: shopDataError || "Loading live shop key price…"}
						</p>
					)}
				</div>
				<div className="conversion-rate-grid">
					<div>
						<small>REGIONAL KEY VALUE · NET</small>
						<strong>
							{regionalKeyPriceForCalculation > 0
								? regionalKeyPriceForCalculation.toLocaleString("en-US", {
										maximumFractionDigits: 2,
									}) +
									" " +
									selectedRegion.currency
								: "Loading…"}
						</strong>
					</div>
					<div>
						<small>SHOP KEY PRICE</small>
						<strong>
							{liveKeyPriceToman > 0
								? formatNumber(liveKeyPriceToman) + " toman"
								: "Loading…"}
						</strong>
					</div>
				</div>
				<p className="conversion-footnote">
					<Info size={14} /> Regional conversions use Steam’s live net key value
					for the selected region. Toman conversions use the live key price from
					the SteamPulse shop feed. Results are estimates.
				</p>
			</section>
		</section>
	);
}
