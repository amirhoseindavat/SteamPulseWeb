import { useState } from "react";

export function useCalculator({
	regionalPriceInput,
	regionalKeyPriceForCalculation,
	liveKeyPriceToman,
	selectedRegion,
}) {
	const [conversionMode, setConversionMode] = useState("currency-to-keys");
	const [conversionAmount, setConversionAmount] = useState("18");

	const numericRegionalPrice = Number(regionalPriceInput);
	const keyCount =
		regionalPriceInput.trim() !== "" &&
		regionalKeyPriceForCalculation > 0 &&
		Number.isFinite(numericRegionalPrice) &&
		numericRegionalPrice > 0
			? Math.ceil(numericRegionalPrice / regionalKeyPriceForCalculation)
			: 0;

	const conversionValue = Number(conversionAmount);
	const conversionValid =
		conversionAmount.trim() !== "" &&
		Number.isFinite(conversionValue) &&
		conversionValue > 0;

	const conversionResult = !conversionValid
		? null
		: conversionMode === "currency-to-keys"
			? regionalKeyPriceForCalculation > 0
				? conversionValue / regionalKeyPriceForCalculation
				: null
			: conversionMode === "toman-to-keys"
				? liveKeyPriceToman > 0
					? conversionValue / liveKeyPriceToman
					: null
				: conversionMode === "keys-to-toman"
					? liveKeyPriceToman > 0
						? conversionValue * liveKeyPriceToman
						: null
					: regionalKeyPriceForCalculation > 0
						? conversionValue * regionalKeyPriceForCalculation
						: null;

	const conversionResultLabel =
		conversionMode === "currency-to-keys" || conversionMode === "toman-to-keys"
			? "Keys"
			: conversionMode === "keys-to-toman"
				? "toman"
				: selectedRegion.currency;

	const conversionResultFormatted =
		conversionResult == null
			? null
			: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
					conversionResult,
				);

	const totalToman =
		keyCount *
		(Number.isFinite(liveKeyPriceToman) && liveKeyPriceToman > 0
			? liveKeyPriceToman
			: 0);

	return {
		conversionMode,
		setConversionMode,
		conversionAmount,
		setConversionAmount,
		numericRegionalPrice,
		keyCount,
		conversionResult,
		conversionResultFormatted,
		conversionResultLabel,
		totalToman,
	};
}
