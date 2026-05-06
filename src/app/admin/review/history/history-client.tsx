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
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}y ago`;
}

interface ActionPillConfig {
  label: string;
  className: string;
}

function getActionPill(action: string): ActionPillConfig {
  switch (action) {
    case "submission_approved":
      return { label: "✓ Approved", className: "bg-lime-100 text-lime-800" };
    case "submission_revision_requested":
      return { label: "↺ Revision", className: "bg-orange-100 text-orange-800" };
    case "submission_deleted":
      return { label: "✕ Deleted", className: "bg-red-100 text-red-700" };
    case "submission_edited":
      return { label: "✎ Edited", className: "bg-blue-100 text-blue-800" };
    case "submission_undone":
      return { label: "↩ Undone", className: "bg-slate-100 text-slate-600" };
    case "submission_logged_manually":
    case "script_logged_manually":
      return { label: "+ Logged", className: "bg-gray-100 text-gray-700" };
    default:
      return { label: action.replace("submission_", "").replace("_", " "), className: "bg-gray-100 text-gray-600" };
  }
}

function humanizeFileName(fileName: string): string {
  return fileName
    .replace(/_/g, " ")
    .replace(/\s+(DRAFT|SCRIPT)\s+(\d+)$/i, " · Draft $2")
    .replace(/\s*Contract\s*\d+\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function describeEvent(event: AuditEvent): { main: string; sub?: string } {
  const b = event.before ?? {};
  const a = event.after ?? {};

  const influencerName = (b.influencer_name ?? a.influencer_name) as string | undefined;
  const deliverableType = (b.deliverable_type ?? a.deliverable_type) as string | undefined;
  const deliverableSeq = (b.deliverable_sequence ?? a.deliverable_sequence) as number | undefined;
  const variantLabel = (b.variant_label ?? a.variant_label) as string | undefined;

  const parts: string[] = [];

  if (influencerName) {
    parts.push(influencerName);
  }

  if (deliverableType) {
    let delivPart = deliverableType;
    if (deliverableSeq != null) delivPart += ` #${deliverableSeq}`;
    if (variantLabel) delivPart += ` — ${variantLabel}`;
    parts.push(delivPart);
  } else if (variantLabel) {
    parts.push(variantLabel);
  }

  if (parts.length > 0) {
    return { main: parts.join(" — ") };
  }

  // No structured context — try to parse a human-readable description from the
  // canonical file_name stored on any field. Works for old events (pre-enrichment)
  // and for deleted submissions where the submission row no longer exists.
  const primary = a.primary as Record<string, unknown> | undefined;
  const fileNameCandidate =
    (b.file_name as string | null)
    ?? (primary?.file_name as string | undefined)
    ?? (Array.isArray(a.assets) && a.assets.length > 0
        ? ((a.assets[0] as Record<string, unknown>)?.file_name as string | undefined)
        : undefined)
    ?? null;

  if (fileNameCandidate) {
    return { main: humanizeFileName(fileNameCandidate) };
  }

  // For logged events: show asset count if we at least have that
  if (event.action === "submission_logged_manually" || event.action === "script_logged_manually") {
    const assetCount = a.assetCount as number | undefined;
    if (assetCount && assetCount > 1) {
      return { main: `${assetCount} assets logged` };
    }
  }

  // Absolute fallback: truncated entity ID
  return { main: event.entity_id.slice(0, 8) + "…" };
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
              const { main: description, sub: descSub } = describeEvent(event);
              const actorRaw = event.actor;
              const actorName = Array.isArray(actorRaw)
                ? (actorRaw[0]?.full_name ?? "System")
                : (actorRaw?.full_name ?? "System");

              // Extract feedback for revision events
              const a = event.after ?? {};
              const feedbackContent = (a.feedback as string | undefined)?.trim();
              const feedbackCaption = (a.feedback_caption as string | undefined)?.trim();
              const hasFeedback = feedbackContent || feedbackCaption;

              return (
                <div key={event.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    {/* Action pill */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${pill.className}`}>
                      {pill.label}
                    </span>

                    {/* Who */}
                    <span className="text-sm font-medium text-im8-burgundy w-32 flex-shrink-0 truncate" title={actorName}>
                      {actorName}
                    </span>

                    {/* What */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-im8-burgundy/80 block truncate" title={description}>
                        {description}
                      </span>
                      {descSub && (
                        <span className="text-xs text-im8-burgundy/40">{descSub}</span>
                      )}
                    </div>

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

                  {/* Feedback text under revision events */}
                  {hasFeedback && event.action === "submission_revision_requested" && (
                    <div className="mt-2 ml-[calc(theme(spacing.10)+theme(spacing.3)+theme(spacing.32)+theme(spacing.3))] space-y-1.5">
                      {feedbackContent && (
                        <div className="text-xs bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-orange-900">
                          <span className="font-semibold text-orange-700 block mb-0.5">Content feedback</span>
                          {feedbackContent}
                        </div>
                      )}
                      {feedbackCaption && (
                        <div className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-900">
                          <span className="font-semibold text-amber-700 block mb-0.5">Caption feedback</span>
                          {feedbackCaption}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
