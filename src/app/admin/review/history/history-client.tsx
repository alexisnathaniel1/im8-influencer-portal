"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

interface AuditEvent {
  id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
  entity_id: string;
  // Supabase returns joined rows as an array; we normalise in describeEvent/render
  actor: { full_name: string } | { full_name: string }[] | null;
}

interface Props {
  events: AuditEvent[];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

interface ActionPillConfig {
  label: string;
  className: string;
}

function getActionPill(action: string): ActionPillConfig {
  switch (action) {
    case "submission_approved":
      return { label: "✓ Approved", className: "bg-green-100 text-green-800" };
    case "submission_revision_requested":
      return { label: "↺ Revision", className: "bg-orange-100 text-orange-800" };
    case "submission_deleted":
      return { label: "✕ Deleted", className: "bg-red-100 text-red-700" };
    case "submission_edited":
      return { label: "✎ Edited", className: "bg-blue-100 text-blue-800" };
    case "submission_undone":
      return { label: "↩ Undone", className: "bg-slate-100 text-slate-700" };
    case "submission_logged_manually":
    case "script_logged_manually":
      return { label: "+ Logged", className: "bg-gray-100 text-gray-700" };
    default:
      return { label: action, className: "bg-gray-100 text-gray-600" };
  }
}

function describeEvent(event: AuditEvent): string {
  const b = event.before ?? {};
  const influencerName = b.influencer_name as string | undefined;
  const deliverableType = b.deliverable_type as string | undefined;
  const deliverableSeq = b.deliverable_sequence as number | undefined;
  const variantLabel = b.variant_label as string | undefined;

  const parts: string[] = [];

  if (influencerName) {
    parts.push(influencerName);
  }

  if (deliverableType) {
    let delivPart = deliverableType;
    if (deliverableSeq != null) delivPart += ` #${deliverableSeq}`;
    if (variantLabel) delivPart += ` (${variantLabel})`;
    parts.push(delivPart);
  } else if (variantLabel) {
    parts.push(variantLabel);
  }

  if (parts.length > 0) {
    return parts.join(" — ");
  }

  // Fallback: truncated entity ID
  return event.entity_id.slice(0, 8) + "…";
}

export default function HistoryClient({ events }: Props) {
  const [localEvents, setLocalEvents] = useState<AuditEvent[]>(events);
  const [undoneIds, setUndoneIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  async function handleUndo(event: AuditEvent) {
    setLoadingIds((prev) => new Set(prev).add(event.id));
    try {
      const res = await fetch(`/api/submissions/${event.entity_id}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(`Undo failed: ${(json as Record<string, unknown>).error ?? res.statusText}`);
        return;
      }
      // Optimistic UI: mark as undone
      setUndoneIds((prev) => new Set(prev).add(event.id));
      setLocalEvents((prev) =>
        prev.map((e) =>
          e.id === event.id ? { ...e, action: "submission_undone" } : e,
        ),
      );
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
    }
  }

  const canUndo = (action: string) =>
    action === "submission_approved" || action === "submission_revision_requested";

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/review" className="text-sm text-im8-red hover:underline mb-1 inline-block">
            &larr; Review queue
          </Link>
          <h1 className="text-2xl font-bold text-im8-burgundy">Review Activity Log</h1>
        </div>
        <span className="text-sm text-im8-burgundy/60 font-medium">
          {localEvents.length} event{localEvents.length === 1 ? "" : "s"}
        </span>
      </div>

      <Card padding="md">
        {localEvents.length === 0 ? (
          <p className="text-center text-im8-burgundy/60 py-8">No review activity yet.</p>
        ) : (
          <div className="divide-y divide-im8-sand">
            {localEvents.map((event) => {
              const pill = getActionPill(event.action);
              const wasUndone = undoneIds.has(event.id);
              const isLoading = loadingIds.has(event.id);
              const showUndo = canUndo(event.action) && !wasUndone;
              const description = describeEvent(event);
              const actorRaw = event.actor;
              const actorName = Array.isArray(actorRaw)
                ? (actorRaw[0]?.full_name ?? "System")
                : (actorRaw?.full_name ?? "System");

              return (
                <div key={event.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  {/* Action pill */}
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${pill.className}`}
                  >
                    {pill.label}
                  </span>

                  {/* Who */}
                  <span className="text-sm font-medium text-im8-burgundy w-32 flex-shrink-0 truncate" title={actorName}>
                    {actorName}
                  </span>

                  {/* What */}
                  <span className="text-sm text-im8-burgundy/70 flex-1 min-w-0 truncate" title={description}>
                    {description}
                  </span>

                  {/* When */}
                  <span
                    className="text-xs text-im8-burgundy/40 flex-shrink-0 whitespace-nowrap"
                    title={new Date(event.created_at).toLocaleString()}
                  >
                    {timeAgo(event.created_at)}
                  </span>

                  {/* Undo button */}
                  <div className="w-16 flex-shrink-0 flex justify-end">
                    {showUndo && (
                      <button
                        type="button"
                        onClick={() => handleUndo(event)}
                        disabled={isLoading}
                        className="text-xs font-bold text-im8-burgundy/50 hover:text-im8-burgundy border border-im8-stone/40 rounded-full px-2.5 py-0.5 transition-colors disabled:opacity-40"
                      >
                        {isLoading ? "…" : "Undo"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
