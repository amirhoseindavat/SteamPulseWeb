export function money(price) {
  if (!price) return "Not available";
  if (price.final_formatted) return price.final_formatted;
  if (Number.isFinite(price.final) && price.currency) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency }).format(price.final / 100);
  }
  return "Not available";
}

export function formatNumber(value) {
  return value == null ? "—" : new Intl.NumberFormat("en-US").format(value);
}
