"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { RatingCheckpoints, DEFAULT_RATINGS, type SubmissionRatings } from "@/components/rating-checkpoints";
import { DriveVideo } from "@/components/drive-video";
import { AIReviewCard, AIReviewBadge } from "@/components/ai-review-card";
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
}

export default function AdminReviewPage() {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "influencer">("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ratingsMap, setRatingsMap] = useState<Record<string, SubmissionRatings>>({});
  const [aiReviewMap, setAiReviewMap] = useState<Record<string, { status: string; recommendation: string | null }>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [savingRating, setSavingRating] = useState<string | null>(null);

  function getRatings(subId: string): SubmissionRatings {
    return ratingsMap[subId] ?? { ...DEFAULT_RATINGS };
  }

  function setRatingsForSub(subId: string, r: SubmissionRatings) {
    setRatingsMap((prev) => ({ ...prev, [subId]: r }));
  }

  async function fetchPending() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("submissions")
      .select(`
        id, file_name, drive_url, drive_file_id, content_type, platform, post_url, submitted_at,
        influencer:influencer_id(full_name),
        deal:deal_id(influencer_name),
        brief:brief_id(title)
      `)
      .eq("status", "pending")
      .order("submitted_at", { ascending: false });

    if (error) { setLoading(false); return; }

    const rows: PendingSubmission[] = [];
    const ids: string[] = [];

    for (const s of data || []) {
      const inf = s.influencer as unknown as { full_name: string } | null;
      const deal = s.deal as unknown as { influencer_name: string } | null;
      const brief = s.brief as unknown as { title: string } | null;
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
      });
      ids.push(s.id);
    }

    setSubmissions(rows);
    setLoading(false);

    if (ids.length > 0) {
      const { data: aiData } = await supabase
        .from("ai_reviews")
        .select("submission_id, status, recommendation, framework_score, authenticity_score, algorithm_score, framework_feedback, authenticity_feedback, algorithm_feedback, general_notes")
        .in("submission_id", ids);

      if (aiData) {
        const aiMap: Record<string, { status: string; recommendation: string | null }> = {};
        const autoRatings: Record<string, SubmissionRatings> = {};
        for (const r of aiData) {
          aiMap[r.submission_id] = { status: r.status, recommendation: r.recommendation };
          if (r.status === "completed" && r.framework_score) {
            autoRatings[r.submission_id] = {
              framework_score: r.framework_score,
              authenticity_score: r.authenticity_score ?? 3,
              algorithm_score: r.algorithm_score ?? 3,
              framework_feedback: r.framework_feedback || "",
              authenticity_feedback: r.authenticity_feedback || "",
              algorithm_feedback: r.algorithm_feedback || "",
              general_notes: r.general_notes || "",
            };
          }
        }
        setAiReviewMap(aiMap);
        setRatingsMap((prev) => ({ ...autoRatings, ...prev }));
      }
    }
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

  async function saveRating(submissionId: string) {
    setSavingRating(submissionId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("submission_ratings").upsert({
        submission_id: submissionId,
        ...getRatings(submissionId),
        rated_by: user.id,
      }, { onConflict: "submission_id" });
    }
    setSavingRating(null);
  }

  async function handleApprove(submissionId: string) {
    setActionLoading(submissionId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("submissions").update({ status: "approved", reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }).eq("id", submissionId);
    if (user) {
      await supabase.from("submission_ratings").upsert({ submission_id: submissionId, ...getRatings(submissionId), rated_by: user.id }, { onConflict: "submission_id" });
    }
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(submissionId); return next; });
    if (expandedId === submissionId) setExpandedId(null);
    setActionLoading(null);
    syncContentLog(submissionId);
  }

  async function handleReject(submissionId: string) {
    setActionLoading(submissionId);
    const r = getRatings(submissionId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("submissions").update({
      status: "rejected",
      feedback: r.general_notes,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", submissionId);
    if (user) {
      await supabase.from("submission_ratings").upsert({ submission_id: submissionId, ...r, rated_by: user.id }, { onConflict: "submission_id" });
    }
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(submissionId); return next; });
    if (expandedId === submissionId) setExpandedId(null);
    setActionLoading(null);
  }

  async function handleRevisionRequest(submissionId: string) {
    setActionLoading(submissionId);
    const r = getRatings(submissionId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("submissions").update({
      status: "revision_requested",
      feedback: r.general_notes,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", submissionId);
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(submissionId); return next; });
    if (expandedId === submissionId) setExpandedId(null);
    setActionLoading(null);
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const ids = Array.from(selectedIds);
    await supabase.from("submissions").update({ status: "approved", reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }).in("id", ids);
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
            const r = getRatings(sub.id);
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
                      {sub.brief_title && <span className="text-xs text-im8-burgundy/50">{sub.brief_title}</span>}
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${sub.content_type === "final" ? "bg-im8-flamingo/20 text-im8-red" : "bg-im8-sand text-im8-burgundy"}`}>
                        {sub.content_type}
                      </span>
                      {aiReviewMap[sub.id] && (
                        <AIReviewBadge status={aiReviewMap[sub.id].status} recommendation={aiReviewMap[sub.id].recommendation} />
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
                    <Button size="sm" variant="danger" onClick={() => handleReject(sub.id)} loading={actionLoading === sub.id}>Reject</Button>
                  </div>
                  <span className="text-im8-burgundy/30 text-lg">{isExpanded ? "▾" : "▸"}</span>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-im8-sand">
                    {fileId && (
                      <DriveVideo
                        fileId={fileId}
                        controls
                        preload="metadata"
                        width="100%"
                        style={{ maxHeight: 360 }}
                        className="block"
                        containerClassName="mb-4 rounded-lg overflow-hidden bg-black"
                        containerStyle={{ maxWidth: 640, minHeight: 80 }}
                      />
                    )}
                    <AIReviewCard
                      submissionId={sub.id}
                      onReviewLoaded={(aiData) => {
                        if (!ratingsMap[sub.id] && aiData.status === "completed" && aiData.framework_score) {
                          setRatingsForSub(sub.id, {
                            framework_score: aiData.framework_score,
                            authenticity_score: aiData.authenticity_score ?? 3,
                            algorithm_score: aiData.algorithm_score ?? 3,
                            framework_feedback: aiData.framework_feedback || "",
                            authenticity_feedback: aiData.authenticity_feedback || "",
                            algorithm_feedback: aiData.algorithm_feedback || "",
                            general_notes: aiData.general_notes || "",
                          });
                        }
                        setAiReviewMap((prev) => ({ ...prev, [sub.id]: { status: aiData.status, recommendation: aiData.recommendation } }));
                      }}
                    />
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-im8-burgundy">Quality Rating</p>
                      <Button size="sm" variant="outline" onClick={() => saveRating(sub.id)} loading={savingRating === sub.id}>Save Rating</Button>
                    </div>
                    <RatingCheckpoints ratings={r} onChange={(updated) => setRatingsForSub(sub.id, updated)} />
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
