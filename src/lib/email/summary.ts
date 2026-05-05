// Truncate an email body to a single short line suitable for inline preview.
// Strips runs of whitespace, trims, and breaks at the last word boundary
// before maxChars (only if that boundary is past 60% of maxChars — otherwise
// hard-truncate so we don't end with a single short word).
export function summarizeEmail(bodyText: string | null | undefined, maxChars = 80): string {
  if (!bodyText) return "";
  const cleaned = bodyText.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  const slice = cleaned.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const stop = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
  return cleaned.slice(0, stop) + "…";
}
