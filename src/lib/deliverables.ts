/**
 * Canonical deliverable catalogue — one source of truth for display labels
 * and binary-rights flags. Mirrors the const exported from
 * src/components/deals/deal-detail-client.tsx and the shared partner /
 * triage-board / email templates so admin UI, partner UI, activity feeds,
 * and outbound emails all show the same friendly names.
 */
export const DELIVERABLE_LABELS: Record<string, string> = {
  // Instagram
  IGR: "Instagram Reels",
  IGS: "Instagram Stories",
  // TikTok
  TIKTOK: "TikTok Videos",
  // YouTube
  YT_DEDICATED: "YouTube Dedicated Review",
  YT_INTEGRATED: "YouTube Integrated Review",
  YT_PODCAST: "YouTube Podcast Ad Read",
  // Other content
  UGC: "UGC Videos",
  NEWSLETTER: "Newsletter",
  APP_PARTNERSHIP: "App Partnership",
  BLOG: "Blog Post",
  // Rights / extras (binary grants — no count)
  WHITELIST: "Whitelisting",
  PAID_AD: "Paid Ad Usage Rights",
  RAW_FOOTAGE: "Raw Footage",
  LINK_BIO: "Link in Bio",
};

export const BINARY_DELIVERABLE_CODES = new Set([
  "WHITELIST",
  "PAID_AD",
  "RAW_FOOTAGE",
  "LINK_BIO",
]);

/** Format a single deliverable as a human-readable phrase. */
export function formatDeliverable(item: { code: string; count: number }): string | null {
  if (!item || !item.code) return null;
  const label = DELIVERABLE_LABELS[item.code] ?? item.code;
  if (BINARY_DELIVERABLE_CODES.has(item.code)) {
    return item.count > 0 ? label : null;
  }
  if (item.count <= 0) return null;
  return `${item.count}× ${label}`;
}

/** Comma-joined summary for activity feeds, audit logs, plain-text emails. */
export function formatDeliverablesSummary(items: Array<{ code: string; count: number }> | null | undefined): string {
  if (!items || items.length === 0) return "no deliverables specified";
  const parts = items.map(formatDeliverable).filter((s): s is string => !!s);
  return parts.length ? parts.join(", ") : "no deliverables specified";
}
