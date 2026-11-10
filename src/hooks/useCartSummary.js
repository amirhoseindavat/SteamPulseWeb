export function useCartSummary({ steamCartDetails, selectedRegion, regionalKeyPriceForCalculation }) {
  const uniqueCartDetails = steamCartDetails;
  const cartCurrency = uniqueCartDetails.find((item) => item.currency)?.currency || selectedRegion.currency;
  const cartTotalMinor = uniqueCartDetails.reduce((sum, item) =>
    sum + (item.price != null && Number.isFinite(Number(item.price)) ? Number(item.price) : 0), 0);
  const cartOriginalTotalMinor = uniqueCartDetails.reduce((sum, item) =>
    sum + (item.initialPrice != null && Number.isFinite(Number(item.initialPrice))
      ? Number(item.initialPrice)
      : (item.price != null && Number.isFinite(Number(item.price)) ? Number(item.price) : 0)), 0);
  const cartPricedItems = uniqueCartDetails.filter((item) =>
    item.price != null && Number.isFinite(Number(item.price)));
  const cartTotalFormatted = cartPricedItems.length
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: cartCurrency }).format(cartTotalMinor / 100)
    : "—";
  const cartOriginalTotalFormatted = cartPricedItems.length
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: cartCurrency }).format(cartOriginalTotalMinor / 100)
    : "—";
  const cartSavingsMinor = Math.max(0, cartOriginalTotalMinor - cartTotalMinor);
  const cartSavingsFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cartCurrency
  }).format(cartSavingsMinor / 100);
  const cartKeyCount = regionalKeyPriceForCalculation > 0 && cartPricedItems.length
    ? Math.ceil((cartTotalMinor / 100) / regionalKeyPriceForCalculation)
    : null;

  return {
    uniqueCartDetails,
    cartCurrency,
    cartTotalFormatted,
    cartOriginalTotalFormatted,
    cartSavingsMinor,
    cartSavingsFormatted,
    cartKeyCount
  };
}
