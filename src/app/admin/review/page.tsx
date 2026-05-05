"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DriveVideo } from "@/components/drive-video";
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
  brief_title: string | null;
  deliverable_type: string | null;
  deliverable_sequence: number | null;
  caption: string | null;
  /** Draft number parsed from file_name (_DRAFT_N suffix) — null if not determinable */
  draftNum: number | null;
}

/** Parse the DRAFT N number from a filename like "…_DRAFT_2" */
function parseDraftNum(fileName: string | null): number | null {
  if (!fileName) return null;
  const m = fileName.match(/_DRAFT_(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

export default function AdminReviewPage() {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "influencer">("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [feedbackCaption, setFeedbackCaption] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  async function fetchPending() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("submissions")
      .select(`
        id, file_name, drive_url, drive_file_id, content_type, platform, post_url, submitted_at, caption,
        influencer:influencer_id(full_name),
        deal:deal_id(influencer_name),
        brief:brief_id(title),
        deliverable:deliverable_id(deliverable_type, sequence)
      `)
      .eq("status", "pending")
      .order("submitted_at", { ascending: false });

    if (error) { setLoading(false); return; }

    const rows: PendingSubmission[] = [];
    for (const s of data || []) {
      const inf = s.influencer as unknown as { full_name: string } | null;
      const deal = s.deal as unknown as { influencer_name: string } | null;
      const brief = s.brief as unknown as { title: string } | null;
      const deliv = s.deliverable as unknown as { deliverable_type: string; sequence: number | null } | null;
      rows.push({
        id: s.id,
        file_name: s.file_name,
        drive_url: s.drive_url,
        drive_file_id: s.drive_file_id,
        content_type: s.content_type,
        platform: s.platform,
        post_url: s.post_url,
        submitted_at: s.submitted_at,
        influencer_name: inf?.full_name || deal?.influencer_name || "Unknown",
        deal_id: (s as Record<string, unknown>).deal_id as string,
        brief_title: brief?.title ?? null,
        deliverable_type: deliv?.deliverable_type ?? null,
        deliverable_sequence: deliv?.sequence ?? null,
        caption: (s as Record<string, unknown>).caption as string | null,
        draftNum: parseDraftNum(s.file_name),
      });
    }

    setSubmissions(rows);
    setLoading(false);
  }

  useEffect(() => { fetchPending(); }, []);

  const sorted = [...submissions].sort((a, b) =>
    sortBy === "newest"
      ? new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      : a.influencer_name.localeCompare(b.influencer_name)
  );

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
    await supabase.from("submissions").update({
      status: "approved",
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", submissionId);
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(submissionId); return next; });
    if (expandedId === submissionId) setExpandedId(null);
    setActionLoading(null);
    syncContentLog(submissionId);
    notifyCreator(submissionId, "approved");
    // Rename the Drive file to …_APPROVED (fire-and-forget — non-blocking)
    fetch(`/api/submissions/${submissionId}/rename-approved`, { method: "POST" }).catch(console.error);
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
    await supabase.from("submissions").update({
      status: "revision_requested",
      feedback: feedback[submissionId] || null,
      feedback_caption: feedbackCaption[submissionId] || null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", submissionId);
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
    setSubmissions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
    setBulkLoading(false);
    ids.forEach(syncContentLog);
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
          <span className="text-sm text-im8-burgundy/60 font-medium">{submissions.length} pending</span>
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
              <Button onClick={handleBulkApprove} loading={bulkLoading} size="sm">
                Approve Selected ({selectedIds.size})
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-3">
          {sorted.map((sub) => {
            const isExpanded = expandedId === sub.id;
            const fileId = sub.drive_file_id || (sub.drive_url ? extractDriveFileId(sub.drive_url) : null);
            return (
              <Card key={sub.id} padding="sm">
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
                      {sub.deliverable_type && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold font-mono bg-purple-100 text-purple-700">
                          {sub.deliverable_type}{sub.deliverable_sequence ? ` #${sub.deliverable_sequence}` : ""}
                        </span>
                      )}
                      {sub.brief_title && !sub.deliverable_type && <span className="text-xs text-im8-burgundy/50">{sub.brief_title}</span>}
                      {sub.draftNum !== null && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 font-mono">
                          DRAFT {sub.draftNum}
                        </span>
                      )}
                      {sub.platform && <span className="text-xs text-im8-burgundy/50 capitalize">{sub.platform}</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      {sub.post_url && (
                        <a href={sub.post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-im8-red hover:underline" onClick={(e) => e.stopPropagation()}>View Post</a>
                      )}
                      {sub.drive_url && (
                        <a href={sub.drive_url} target="_blank" rel="noopener noreferrer" className="text-xs text-im8-red hover:underline" onClick={(e) => e.stopPropagation()}>View File</a>
                      )}
                      <span className="text-xs text-im8-burgundy/40">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="primary" onClick={() => handleApprove(sub.id)} loading={actionLoading === sub.id}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRevisionRequest(sub.id)} loading={actionLoading === sub.id}>Revise</Button>
                  </div>
                  <span className="text-im8-burgundy/30 text-lg">{isExpanded ? "▾" : "▸"}</span>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-im8-sand space-y-4">
                    {fileId && (
                      <DriveVideo
                        fileId={fileId}
                        driveUrl={sub.drive_url ?? undefined}
                        controls
                        preload="metadata"
                        width="100%"
                        style={{ maxHeight: 360 }}
                        className="block"
                        containerClassName="rounded-lg overflow-hidden bg-black"
                        containerStyle={{ maxWidth: 640, minHeight: 80 }}
                      />
                    )}

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
            );
          })}
          {sorted.length === 0 && (
            <Card padding="lg">
              <p className="text-center text-im8-burgundy/60">No pending submissions. All caught up!</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
