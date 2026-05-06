"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DriveVideo } from "@/components/drive-video";
import { assetLabel, type AssetType, type VariantAsset } from "@/lib/submissions/asset-types";
import Link from "next/link";

function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

interface PendingSubmission {
  id: string;
  file_name: string | null;
  drive_url: string | null;
  drive_file_id: string | null;
  content_type: string;
  platform: string | null;
  post_url: string | null;
  submitted_at: string;
  influencer_name: string;
  deal_id: string;
  deliverable_id: string | null;
  deal_drive_folder_id: string | null;
  brief_title: string | null;
  brief_id: string | null;
  deliverable_type: string | null;
  deliverable_sequence: number | null;
  caption: string | null;
  variant_label: string | null;
  is_script: boolean;
  /** Short creator bio for reviewer context, sourced from deals.creator_bio */
  creator_bio: string | null;
  /** Niche category tags from deals.niche_tags — surfaced as inline pills */
  niche_tags: string[];
  /** Additional assets bundled with this submission. Empty for legacy single-asset rows. */
  variants: VariantAsset[];
  /** Draft number parsed from file_name (_DRAFT_N or _SCRIPT_N suffix) — null if not determinable */
  draftNum: number | null;
}

/** Parse the DRAFT N or SCRIPT N number from a filename like "…_DRAFT_2" or "…_SCRIPT_1" */
function parseDraftNum(fileName: string | null): number | null {
  if (!fileName) return null;
  const m = fileName.match(/_(DRAFT|SCRIPT)_(\d+)$/);
  return m ? parseInt(m[2], 10) : null;
}

interface DeliverableOption {
  id: string;
  deliverable_type: string;
  sequence: number | null;
}

interface EditState {
  deliverable_id: string | null;
  variant_label: string;
  caption: string;
  drive_url: string;
  draft_num: number | string;  // string so the input can be empty while typing
}

export default function AdminReviewPage() {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [revisions, setRevisions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "influencer">("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [feedbackCaption, setFeedbackCaption] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [expandedVideoKey, setExpandedVideoKey] = useState<string | null>(null);

  // Edit-in-place state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, EditState>>({});
  const [editSaving, setEditSaving] = useState(false);
  // deliverable options per deal_id, fetched on demand
  const [deliverableOptions, setDeliverableOptions] = useState<Record<string, DeliverableOption[]>>({});

  function mapSubmissionRows(data: unknown[]): PendingSubmission[] {
    const rows: PendingSubmission[] = [];
    for (const raw of data) {
      const s = raw as Record<string, unknown>;
      const inf = s.influencer as { full_name: string } | null;
      const deal = s.deal as { influencer_name: string; drive_folder_id?: string | null; creator_bio?: string | null; niche_tags?: string[] | null } | null;
      const brief = s.brief as { title: string } | null;
      const deliv = s.deliverable as { deliverable_type: string; sequence: number | null; brief_id: string | null } | null;
      rows.push({
        id: s.id as string,
        file_name: s.file_name as string | null,
        drive_url: s.drive_url as string | null,
        drive_file_id: s.drive_file_id as string | null,
        content_type: s.content_type as string,
        platform: s.platform as string | null,
        post_url: s.post_url as string | null,
        submitted_at: s.submitted_at as string,
        influencer_name: inf?.full_name || deal?.influencer_name || "Unknown",
        deal_id: s.deal_id as string,
        deliverable_id: s.deliverable_id as string | null,
        deal_drive_folder_id: deal?.drive_folder_id ?? null,
        brief_title: brief?.title ?? null,
        brief_id: (s.brief_id as string | null) ?? deliv?.brief_id ?? null,
        deliverable_type: deliv?.deliverable_type ?? null,
        deliverable_sequence: deliv?.sequence ?? null,
        caption: s.caption as string | null,
        variant_label: s.variant_label as string | null,
        is_script: !!(s.is_script),
        creator_bio: deal?.creator_bio ?? null,
        niche_tags: Array.isArray(deal?.niche_tags) ? (deal!.niche_tags as string[]) : [],
        variants: Array.isArray(s.variants) ? (s.variants as VariantAsset[]) : [],
        draftNum: parseDraftNum(s.file_name as string | null),
      });
    }
    return rows;
  }

  async function fetchPending() {
    const supabase = createClient();
    const SELECT_FIELDS = `
      id, file_name, drive_url, drive_file_id, content_type, platform, post_url, submitted_at, caption,
      deal_id, deliverable_id, brief_id, variant_label, is_script, variants,
      influencer:influencer_id(full_name),
      deal:deal_id(influencer_name, drive_folder_id, creator_bio, niche_tags),
      brief:brief_id(title),
      deliverable:deliverable_id(deliverable_type, sequence, brief_id)
    `;

    const [pendingRes, revisionRes] = await Promise.all([
      supabase.from("submissions").select(SELECT_FIELDS).eq("status", "pending").order("submitted_at", { ascending: false }),
      supabase.from("submissions").select(SELECT_FIELDS).eq("status", "revision_requested").order("submitted_at", { ascending: false }),
    ]);

    if (!pendingRes.error) setSubmissions(mapSubmissionRows(pendingRes.data ?? []));
    if (!revisionRes.error) setRevisions(mapSubmissionRows(revisionRes.data ?? []));
    setLoading(false);
  }

  useEffect(() => { fetchPending(); }, []);

  // Primary sort by user choice; secondary keeps same-deliverable submissions
  // visually adjacent so the group stripe reads correctly.
  const sorted = [...submissions].sort((a, b) => {
    const primary = sortBy === "newest"
      ? new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      : a.influencer_name.localeCompare(b.influencer_name);
    if (primary !== 0) return primary;
    if (a.deal_id !== b.deal_id) return a.deal_id.localeCompare(b.deal_id);
    return (a.deliverable_id ?? "").localeCompare(b.deliverable_id ?? "");
  });

  // Stripe colour rotates per consecutive deliverable group.
  const STRIPE_COLOURS = ["#a78bfa", "#34d399", "#f59e0b", "#60a5fa", "#f472b6", "#22d3ee"];
  const stripeByKey = new Map<string, string>();
  let stripeCursor = 0;
  let prevKey: string | null = null;
  for (const s of sorted) {
    const key = `${s.deal_id}|${s.deliverable_id ?? ""}`;
    if (key !== prevKey) {
      stripeByKey.set(key, STRIPE_COLOURS[stripeCursor % STRIPE_COLOURS.length]);
      stripeCursor++;
    }
    // Same key gets the same colour the second time around
    if (!stripeByKey.has(key)) stripeByKey.set(key, STRIPE_COLOURS[(stripeCursor - 1) % STRIPE_COLOURS.length]);
    prevKey = key;
  }
  function stripeFor(s: PendingSubmission) {
    return stripeByKey.get(`${s.deal_id}|${s.deliverable_id ?? ""}`) ?? "transparent";
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function syncContentLog(submissionId: string) {
    fetch("/api/submissions/sync-content-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    }).catch(console.error);
  }

  function notifyCreator(submissionId: string, action: "approved" | "revision_requested", feedbackText?: string) {
    fetch(`/api/submissions/${submissionId}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, feedback: feedbackText }),
    }).catch(console.error);
  }

  async function handleApprove(submissionId: string) {
    setActionLoading(submissionId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const res = await fetch(`/api/submissions/${submissionId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewedBy: user?.id }),
    });
    if (!res.ok) { setActionLoading(null); return; }
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(submissionId); return next; });
    if (expandedId === submissionId) setExpandedId(null);
    setActionLoading(null);
    syncContentLog(submissionId);
    notifyCreator(submissionId, "approved");
  }

  function combinedFeedback(submissionId: string): string {
    const content = feedback[submissionId]?.trim();
    const caption = feedbackCaption[submissionId]?.trim();
    if (content && caption) return `Content: ${content}\n\nCaption: ${caption}`;
    return content || caption || "";
  }

  async function handleRevisionRequest(submissionId: string) {
    setActionLoading(submissionId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const res = await fetch(`/api/submissions/${submissionId}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedback: feedback[submissionId] || null,
        feedback_caption: feedbackCaption[submissionId] || null,
        reviewedBy: user?.id,
      }),
    });
    if (!res.ok) { setActionLoading(null); return; }
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(submissionId); return next; });
    if (expandedId === submissionId) setExpandedId(null);
    setActionLoading(null);
    notifyCreator(submissionId, "revision_requested", combinedFeedback(submissionId));
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const ids = Array.from(selectedIds);
    await supabase.from("submissions").update({
      status: "approved",
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).in("id", ids);
    // Sync deliverable statuses → approved
    const deliverableIds = ids
      .map((id) => submissions.find((s) => s.id === id)?.deliverable_id)
      .filter((d): d is string => !!d);
    const uniqueDeliverableIds = [...new Set(deliverableIds)];
    if (uniqueDeliverableIds.length > 0) {
      Promise.resolve(
        supabase.from("deliverables")
          .update({ status: "approved" })
          .in("id", uniqueDeliverableIds)
      ).catch(console.error);
    }
    setSubmissions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
    setBulkLoading(false);
    ids.forEach(syncContentLog);
  }

  async function handleDelete(submissionId: string) {
    const sub = submissions.find((s) => s.id === submissionId);
    const label = sub
      ? `${sub.influencer_name} — ${sub.deliverable_type ?? "submission"}${sub.deliverable_sequence ? ` #${sub.deliverable_sequence}` : ""}`
      : "this submission";
    if (!confirm(`Delete ${label}?\n\nThe submissions row will be removed from the review queue. Drive file(s) will be renamed with a "DELETED_" prefix so they're flagged but not lost.`)) {
      return;
    }
    setActionLoading(submissionId);
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(`Could not delete: ${json.error ?? res.statusText}`);
        return;
      }
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(submissionId); return next; });
      if (expandedId === submissionId) setExpandedId(null);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} submission${selectedIds.size === 1 ? "" : "s"}?\n\nThe submissions rows will be removed from the review queue. Drive files will be renamed with a "DELETED_" prefix.`)) {
      return;
    }
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/submissions/${id}`, { method: "DELETE" })),
    );
    const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
    if (failed.length > 0) {
      alert(`${failed.length} of ${ids.length} could not be deleted. The rest were removed.`);
    }
    const succeeded = new Set(
      ids.filter((_, i) => {
        const r = results[i];
        return r.status === "fulfilled" && r.value.ok;
      }),
    );
    setSubmissions((prev) => prev.filter((s) => !succeeded.has(s.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      succeeded.forEach((id) => next.delete(id));
      return next;
    });
    setBulkLoading(false);
  }

  const [undoLoadingId, setUndoLoadingId] = useState<string | null>(null);

  /** Reset a revision_requested submission back to pending so it reappears in the queue. */
  async function handleUndo(sub: PendingSubmission) {
    setUndoLoadingId(sub.id);
    try {
      const res = await fetch(`/api/submissions/${sub.id}/undo`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(`Undo failed: ${(json as Record<string, unknown>).error ?? res.statusText}`);
        return;
      }
      // Move from revisions list back into pending queue
      setRevisions((prev) => prev.filter((s) => s.id !== sub.id));
      setSubmissions((prev) => [{ ...sub }, ...prev]);
    } finally {
      setUndoLoadingId(null);
    }
  }

  /** Open the edit panel for a submission, pre-filling its current values. */
  async function openEdit(sub: PendingSubmission) {
    // Pre-fill from current values
    setEditState((prev) => ({
      ...prev,
      [sub.id]: {
        deliverable_id: sub.deliverable_id,
        variant_label: sub.variant_label ?? "",
        caption: sub.caption ?? "",
        drive_url: sub.drive_url ?? "",
        draft_num: parseDraftNum(sub.file_name) ?? 1,
      },
    }));
    setEditingId(sub.id);
    // Make sure the card is expanded
    setExpandedId(sub.id);

    // Fetch deliverables for this deal if we haven't yet
    if (!deliverableOptions[sub.deal_id]) {
      const supabase = createClient();
      const { data } = await supabase
        .from("deliverables")
        .select("id, deliverable_type, sequence")
        .eq("deal_id", sub.deal_id)
        .order("sequence", { ascending: true });
      setDeliverableOptions((prev) => ({
        ...prev,
        [sub.deal_id]: (data ?? []) as DeliverableOption[],
      }));
    }
  }

  function cancelEdit(id: string) {
    setEditingId(null);
    setEditState((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  async function saveEdit(id: string) {
    const state = editState[id];
    if (!state) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverable_id: state.deliverable_id || null,
          variant_label: state.variant_label.trim() || null,
          caption: state.caption.trim() || null,
          drive_url: state.drive_url.trim() || null,
          draft_num: Number(state.draft_num) || 1,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(`Save failed: ${json.error ?? res.statusText}`);
        return;
      }
      // Update local state
      setSubmissions((prev) => prev.map((s) => {
        if (s.id !== id) return s;
        const opts = deliverableOptions[s.deal_id] ?? [];
        const deliv = opts.find((d) => d.id === state.deliverable_id);
        return {
          ...s,
          deliverable_id: state.deliverable_id,
          deliverable_type: deliv?.deliverable_type ?? s.deliverable_type,
          deliverable_sequence: deliv?.sequence ?? s.deliverable_sequence,
          variant_label: state.variant_label.trim() || null,
          caption: state.caption.trim() || null,
          drive_url: state.drive_url.trim() || s.drive_url,
          draftNum: Number(state.draft_num) || s.draftNum,
        };
      }));
      cancelEdit(id);
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-im8-offwhite flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-im8-red border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Dashboard</Link>
            <h1 className="text-2xl font-bold text-im8-burgundy">Review Queue</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-im8-burgundy/60 font-medium">{submissions.length} pending</span>
            <Link
              href="/admin/review/history"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-im8-stone/40 bg-white text-xs font-bold uppercase tracking-[0.08em] text-im8-burgundy hover:bg-im8-offwhite transition-colors"
            >
              Activity log
            </Link>
            <Link
              href="/admin/review/log"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-im8-burgundy text-white text-xs font-bold uppercase tracking-[0.08em] hover:bg-im8-dark transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Log received content
            </Link>
          </div>
        </div>

        <Card padding="md" className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="w-48">
              <Select
                options={[{ value: "newest", label: "Newest First" }, { value: "influencer", label: "By Influencer" }]}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "influencer")}
              />
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Button onClick={handleBulkApprove} loading={bulkLoading} size="sm">
                  Approve Selected ({selectedIds.size})
                </Button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-bold uppercase tracking-[0.08em] hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                  </svg>
                  Delete ({selectedIds.size})
                </button>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-3">
          {sorted.map((sub) => {
            const isExpanded = expandedId === sub.id;
            const fileId = sub.drive_file_id || (sub.drive_url ? extractDriveFileId(sub.drive_url) : null);
            const stripe = stripeFor(sub);
            return (
              <div key={sub.id} className="relative" style={{ borderLeft: `3px solid ${stripe}`, borderRadius: 6 }}>
              <Card padding="sm">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : sub.id)}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sub.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(sub.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-im8-stone text-im8-red focus:ring-im8-red"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/admin/deals/${sub.deal_id}`} className="text-sm font-semibold text-im8-burgundy hover:underline" onClick={(e) => e.stopPropagation()}>
                        {sub.influencer_name}
                      </Link>
                      {sub.deal_drive_folder_id && (
                        <a
                          href={`https://drive.google.com/drive/folders/${sub.deal_drive_folder_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open Drive folder"
                          onClick={(e) => e.stopPropagation()}
                          className="text-im8-burgundy/30 hover:text-[#4285F4] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4.5 19.5L9 12l4.5 7.5H4.5zM19.5 19.5l-3-7.5H12l3 7.5h4.5zM12 4.5L8.25 12h7.5L12 4.5z"/>
                          </svg>
                        </a>
                      )}
                      {sub.deliverable_type && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold font-mono bg-purple-100 text-purple-700">
                          {sub.deliverable_type}{sub.deliverable_sequence ? ` #${sub.deliverable_sequence}` : ""}
                        </span>
                      )}
                      {sub.brief_title && !sub.deliverable_type && <span className="text-xs text-im8-burgundy/50">{sub.brief_title}</span>}
                      {sub.variant_label && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 font-mono uppercase tracking-wide border border-purple-200">
                          {sub.variant_label}
                        </span>
                      )}
                      {sub.is_script && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 font-mono uppercase tracking-wide">
                          SCRIPT{sub.draftNum !== null ? ` ${sub.draftNum}` : ""}
                        </span>
                      )}
                      {!sub.is_script && sub.draftNum !== null && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 font-mono">
                          DRAFT {sub.draftNum}
                        </span>
                      )}
                      {sub.variants.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          {1 + sub.variants.length} assets
                        </span>
                      )}
                      {sub.platform && <span className="text-xs text-im8-burgundy/50 capitalize">{sub.platform}</span>}
                      {sub.niche_tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-im8-sand/60 text-im8-burgundy/70 border border-im8-stone/40 capitalize"
                          title={sub.niche_tags.join(", ")}
                        >
                          {tag}
                        </span>
                      ))}
                      {sub.niche_tags.length > 2 && (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-im8-burgundy/50"
                          title={sub.niche_tags.slice(2).join(", ")}
                        >
                          +{sub.niche_tags.length - 2}
                        </span>
                      )}
                    </div>
                    {sub.creator_bio && (
                      <p className="mt-1 text-[12px] text-im8-burgundy/65 italic leading-snug line-clamp-2">
                        {sub.creator_bio}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      {sub.brief_id && (
                        <Link
                          href={`/admin/briefs/${sub.brief_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-im8-red hover:underline"
                          title={sub.brief_title ? `Brief: ${sub.brief_title}` : "View brief"}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View Brief
                        </Link>
                      )}
                      {sub.post_url && (
                        <a href={sub.post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-im8-red hover:underline" onClick={(e) => e.stopPropagation()}>View Post</a>
                      )}
                      {sub.drive_url && (
                        <a href={sub.drive_url} target="_blank" rel="noopener noreferrer" className="text-xs text-im8-red hover:underline" onClick={(e) => e.stopPropagation()}>View File</a>
                      )}
                      <span className="text-xs text-im8-burgundy/40">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                      {!sub.creator_bio && sub.deal_id && (
                        <Link
                          href={`/admin/deals/${sub.deal_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-im8-burgundy/40 hover:text-im8-burgundy hover:underline italic"
                        >
                          + Add bio
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="primary" onClick={() => handleApprove(sub.id)} loading={actionLoading === sub.id}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRevisionRequest(sub.id)} loading={actionLoading === sub.id}>Revise</Button>
                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => editingId === sub.id ? cancelEdit(sub.id) : openEdit(sub)}
                      disabled={actionLoading === sub.id}
                      title="Edit submission details"
                      aria-label="Edit submission"
                      className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${editingId === sub.id ? "text-im8-burgundy bg-im8-sand/40 hover:bg-im8-sand/60" : "text-im8-burgundy/40 hover:text-im8-burgundy hover:bg-im8-sand/40"}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(sub.id)}
                      disabled={actionLoading === sub.id}
                      title="Delete submission (duplicates / tests)"
                      aria-label="Delete submission"
                      className="p-1.5 rounded-md text-im8-burgundy/40 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                      </svg>
                    </button>
                  </div>
                  <span className="text-im8-burgundy/30 text-lg">{isExpanded ? "▾" : "▸"}</span>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-im8-sand space-y-4">

                    {/* ── Edit panel ── */}
                    {editingId === sub.id && editState[sub.id] && (
                      <div className="bg-im8-sand/30 border border-im8-stone/40 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.08em]">Edit details</span>
                          <span className="text-[11px] text-im8-burgundy/40">Changes are saved to the database only — Drive filenames are not updated.</span>
                        </div>

                        {/* Deliverable picker */}
                        <div>
                          <label className="block text-xs font-medium text-im8-burgundy mb-1">Deliverable</label>
                          <select
                            value={editState[sub.id].deliverable_id ?? ""}
                            onChange={(e) => setEditState((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], deliverable_id: e.target.value || null } }))}
                            className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30"
                          >
                            <option value="">— No deliverable —</option>
                            {(deliverableOptions[sub.deal_id] ?? []).map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.deliverable_type}{d.sequence != null ? ` #${d.sequence}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Variant label */}
                        <div>
                          <label className="block text-xs font-medium text-im8-burgundy mb-1">Asset label <span className="text-im8-burgundy/40 font-normal">(e.g. Hook 1, Full Reel)</span></label>
                          <input
                            type="text"
                            value={editState[sub.id].variant_label}
                            onChange={(e) => setEditState((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], variant_label: e.target.value } }))}
                            placeholder="Hook 1, Full Reel, Body…"
                            className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30"
                          />
                        </div>

                        {/* Caption */}
                        <div>
                          <label className="block text-xs font-medium text-im8-burgundy mb-1">Caption</label>
                          <textarea
                            value={editState[sub.id].caption}
                            onChange={(e) => setEditState((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], caption: e.target.value } }))}
                            rows={3}
                            placeholder="Instagram / TikTok caption text…"
                            className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
                          />
                        </div>

                        {/* Drive URL */}
                        <div>
                          <label className="block text-xs font-medium text-im8-burgundy mb-1">Drive URL <span className="text-im8-burgundy/40 font-normal">(correct if logged incorrectly)</span></label>
                          <input
                            type="text"
                            value={editState[sub.id].drive_url}
                            onChange={(e) => setEditState((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], drive_url: e.target.value } }))}
                            placeholder="https://drive.google.com/…"
                            className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30 font-mono text-xs"
                          />
                        </div>

                        {/* Draft number */}
                        <div>
                          <label className="block text-xs font-medium text-im8-burgundy mb-1">
                            Draft number <span className="text-im8-burgundy/40 font-normal">(use 1 if this was incorrectly logged as Draft 2+)</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={editState[sub.id].draft_num}
                            onChange={(e) => setEditState((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], draft_num: e.target.value } }))}
                            className="w-24 px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30"
                          />
                          <p className="mt-1 text-[11px] text-im8-burgundy/40">Updating the number also renames the Drive file.</p>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => saveEdit(sub.id)}
                            disabled={editSaving}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-im8-burgundy text-white text-xs font-bold uppercase tracking-[0.08em] hover:bg-im8-dark transition-colors disabled:opacity-50"
                          >
                            {editSaving ? "Saving…" : "Save changes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelEdit(sub.id)}
                            className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.08em] text-im8-burgundy/60 hover:text-im8-burgundy hover:bg-im8-sand/40 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Assets accordion — one video expandable at a time */}
                    {(() => {
                      const allAssets = [
                        {
                          label: sub.variant_label || "Primary",
                          fileId,
                          file_name: sub.file_name,
                          drive_url: sub.drive_url,
                          idx: 0,
                        },
                        ...sub.variants.map((v, i) => ({
                          label: v.label || assetLabel(v.asset_type as AssetType),
                          fileId: v.drive_file_id || (v.drive_url ? extractDriveFileId(v.drive_url) : null),
                          file_name: v.file_name,
                          drive_url: v.drive_url,
                          idx: i + 1,
                        })),
                      ];
                      return (
                        <div>
                          <span className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.08em] mb-2 block">
                            Assets ({allAssets.length})
                          </span>
                          <ul className="space-y-1.5">
                            {allAssets.map((asset) => {
                              const vKey = `${sub.id}__${asset.idx}`;
                              const isOpen = expandedVideoKey === vKey;
                              return (
                                <li key={vKey} className="border border-im8-stone/30 rounded-lg overflow-hidden">
                                  <div className="flex items-center gap-3 px-3 py-2.5 bg-im8-offwhite/60">
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 font-mono uppercase tracking-wide border border-purple-200 flex-shrink-0">
                                      {asset.label}
                                    </span>
                                    <span className="text-xs font-mono text-im8-burgundy/50 truncate flex-1 min-w-0">
                                      {asset.file_name ?? ""}
                                    </span>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {asset.fileId && (
                                        <button
                                          type="button"
                                          onClick={() => setExpandedVideoKey(isOpen ? null : vKey)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.06em] border transition-colors border-im8-stone/40 bg-white hover:border-im8-burgundy/40 text-im8-burgundy"
                                        >
                                          {isOpen ? "▾ Hide" : "▶ Play"}
                                        </button>
                                      )}
                                      {asset.drive_url && (
                                        <a
                                          href={asset.drive_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-im8-red hover:underline"
                                        >
                                          Open →
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  {isOpen && asset.fileId && (
                                    <DriveVideo
                                      fileId={asset.fileId}
                                      driveUrl={asset.drive_url ?? undefined}
                                      controls
                                      autoPlay
                                      preload="auto"
                                      width="100%"
                                      style={{ maxHeight: 420 }}
                                      className="block"
                                      containerClassName="rounded-b-lg overflow-hidden bg-black"
                                      containerStyle={{ maxWidth: "100%", minHeight: 80 }}
                                    />
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Caption */}
                    {sub.caption ? (
                      <div className="bg-im8-offwhite border border-im8-stone/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.08em]">Caption</span>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(sub.caption ?? "");
                              setCopiedId(sub.id);
                              setTimeout(() => setCopiedId(null), 1500);
                            }}
                            className="text-[11px] font-semibold text-im8-red hover:underline"
                          >
                            {copiedId === sub.id ? "Copied ✓" : "Copy"}
                          </button>
                        </div>
                        <p className="text-[13px] text-im8-burgundy whitespace-pre-wrap leading-relaxed">{sub.caption}</p>
                      </div>
                    ) : (
                      <div className="text-[12px] text-im8-muted italic">No caption submitted with this content.</div>
                    )}

                    {/* Two-column feedback */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-im8-burgundy mb-1">
                          Feedback on content <span className="text-im8-burgundy/40 font-normal">(visual)</span>
                        </label>
                        <textarea
                          value={feedback[sub.id] ?? ""}
                          onChange={(e) => setFeedback(prev => ({ ...prev, [sub.id]: e.target.value }))}
                          rows={4}
                          placeholder="Lighting, pacing, hook, b-roll…"
                          className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-im8-burgundy mb-1">
                          Feedback on caption <span className="text-im8-burgundy/40 font-normal">(text)</span>
                        </label>
                        <textarea
                          value={feedbackCaption[sub.id] ?? ""}
                          onChange={(e) => setFeedbackCaption(prev => ({ ...prev, [sub.id]: e.target.value }))}
                          rows={4}
                          placeholder="Hook line, CTA, hashtags, brand mentions…"
                          className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-im8-muted">Both fields are sent to the creator when requesting a revision.</p>
                  </div>
                )}
              </Card>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <Card padding="lg">
              <p className="text-center text-im8-burgundy/60">No pending submissions. All caught up!</p>
            </Card>
          )}
        </div>

        {/* ── Revision requested section ─────────────────────────────────────── */}
        {revisions.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-semibold text-im8-burgundy">Revision requested</h2>
              <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                {revisions.length}
              </span>
              <span className="text-xs text-im8-burgundy/40">
                Waiting for creator to resubmit — click ↩ Undo to put back in the review queue if sent by mistake.
              </span>
            </div>
            <div className="space-y-2">
              {revisions.map((sub) => (
                <Card key={sub.id} padding="sm">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-im8-burgundy text-sm">{sub.influencer_name}</span>
                        {sub.deliverable_type && (
                          <span className="font-mono text-xs bg-im8-sand/60 px-1.5 py-0.5 rounded text-im8-burgundy">
                            {sub.deliverable_type}{sub.deliverable_sequence ? ` #${sub.deliverable_sequence}` : ""}
                          </span>
                        )}
                        {sub.variant_label && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                            {sub.variant_label}
                          </span>
                        )}
                        {sub.draftNum && (
                          <span className="text-xs text-im8-burgundy/50">Draft {sub.draftNum}</span>
                        )}
                      </div>
                      {sub.drive_url && (
                        <a
                          href={sub.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-im8-red hover:underline truncate max-w-[300px] block mt-0.5"
                        >
                          {sub.file_name ?? "Open in Drive ↗"}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-im8-burgundy/40">
                        {new Date(sub.submitted_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUndo(sub)}
                        disabled={undoLoadingId === sub.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] rounded-full border border-im8-stone/40 text-im8-burgundy hover:bg-im8-offwhite transition-colors disabled:opacity-50"
                      >
                        {undoLoadingId === sub.id ? "…" : "↩ Undo"}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
