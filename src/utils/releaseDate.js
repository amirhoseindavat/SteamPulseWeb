export function hasCompleteReleaseDate(value) {
  const dateText = String(value || "").trim();
  const includesDay = /\b\d{4}-\d{2}-\d{2}\b/.test(dateText)
    || /\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,}\b.*\b\d{4}\b/i.test(dateText)
    || /\b[A-Za-z]{3,}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i.test(dateText);
  return includesDay && Number.isFinite(new Date(dateText).getTime());
}
