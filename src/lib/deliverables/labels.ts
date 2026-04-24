// Central helper for displaying a deliverable row consistently across admin +
// creator UIs. Keep this as the single source of truth — if the format changes
// (e.g. we want to localise or drop the #), update it here.

import { DELIVERABLE_LABELS } from "@/components/deals/deal-detail-client";

type DeliverableLike = {
  deliverable_type: string;
  sequence?: number | null;
  title?: string | null;
};

/** "IGR #1" or just "IGR" if no sequence. Use for compact badges. */
export function formatDeliverableBadge(d: DeliverableLike): string {
  if (d.sequence && d.sequence > 0) return `${d.deliverable_type} #${d.sequence}`;
  return d.deliverable_type;
}

/** "IGR #1 — Tegan Martin" — use for dropdowns / list rows with context. */
export function formatDeliverableWithCreator(d: DeliverableLike, creatorName: string): string {
  return `${formatDeliverableBadge(d)} — ${creatorName}`;
}

/** Friendly label: "Instagram Reels #1". */
export function formatDeliverableFull(d: DeliverableLike): string {
  const label = DELIVERABLE_LABELS[d.deliverable_type] ?? d.deliverable_type;
  if (d.sequence && d.sequence > 0) return `${label} #${d.sequence}`;
  return label;
}
