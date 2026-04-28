"use client";

import { useState } from "react";
import { formatDeliverablesSummary } from "@/lib/deliverables";
import type { ReviewDeal, ReviewComment } from "./page";

type Decision = "approval" | "revision_request" | "rejection";

const DECISION_BUTTONS: Array<{ kind: Decision; label: string; activeClass: string; idleClass: string }> = [
  {
    kind: "approval",
    label: "✓ Approve",
    activeClass: "bg-green-600 text-white border-green-600",
    idleClass: "bg-white text-green-700 border-green-300 hover:bg-green-50",
  },
  {
    kind: "revision_request",
    label: "⟳ Request changes",
    activeClass: "bg-amber-500 text-white border-amber-500",
    idleClass: "bg-white text-amber-700 border-amber-300 hover:bg-amber-50",
  },
  {
    kind: "rejection",
    label: "✗ Reject",
    activeClass: "bg-red-600 text-white border-red-600",
    idleClass: "bg-white text-red-700 border-red-300 hover:bg-red-50",
  },
];

export default function ReviewForm({
  packetId,
  token,
  defaultName,
  isClosed,
  deals,
  existingComments,
}: {
  packetId: string;
  token: string;
  defaultName: string;
  isClosed: boolean;
  deals: ReviewDeal[];
  existingComments: ReviewComment[];
}) {
  const [name, setName] = useState(defaultName);
  // per-deal state: which decision was selected, plus comment text
  const [perDealDecision, setPerDealDecision] = useState<Record<string, Decision | null>>({});
  const [perDealComment, setPerDealComment] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [generalComment, setGeneralComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setDecision(dealId: string, kind: Decision) {
    setPerDealDecision(p => ({ ...p, [dealId]: p[dealId] === kind ? null : kind }));
  }
  function toggleExpand(dealId: string) {
    setExpanded(p => ({ ...p, [dealId]: !p[dealId] }));
  }

  if (isClosed) {
    return (
      <div className="bg-white rounded-xl border border-im8-stone/20 p-6 text-center text-im8-burgundy/50 text-sm">
        This batch has already been finalised. No further responses needed.
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl border border-green-200 p-8 text-center">
        <div className="text-3xl mb-3">✓</div>
        <h2 className="text-lg font-semibold text-im8-burgundy mb-1">Response received</h2>
        <p className="text-sm text-im8-burgundy/60">
          Your decisions have been recorded and will appear in the IM8 portal for the team to action.
        </p>
      </div>
    );
  }

  async function submit() {
    if (!name.trim()) {
      setError("Please enter your name first.");
      return;
    }
    const decisionEntries = Object.entries(perDealDecision).filter(([, v]) => !!v) as Array<[string, Decision]>;
    const hasGeneral = generalComment.trim().length > 0;
    if (decisionEntries.length === 0 && !hasGeneral) {
      setError("Leave a decision on at least one creator, or add a general comment for the batch.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build the payload — one comment per per-deal decision plus an optional
      // batch-level comment. The API is updated to accept either a single
      // legacy {kind, body} payload or a new {comments: [...]} array.
      const dealById = Object.fromEntries(deals.map(d => [d.id, d]));
      const commentsPayload: Array<{ kind: string; body: string }> = [];

      for (const [dealId, kind] of decisionEntries) {
        const dealName = dealById[dealId]?.influencer_name ?? "creator";
        const note = (perDealComment[dealId] ?? "").trim();
        const verb = kind === "approval" ? "Approved" : kind === "rejection" ? "Rejected" : "Requested changes";
        const body = note ? `[${dealName}] ${verb}: ${note}` : `[${dealName}] ${verb}`;
        commentsPayload.push({ kind, body });
      }

      if (hasGeneral) {
        commentsPayload.push({ kind: "comment", body: generalComment.trim() });
      }

      const res = await fetch(`/api/review/${packetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reviewerName: name, comments: commentsPayload }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to submit"); return; }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Per-creator review cards */}
      <div className="bg-white rounded-2xl border border-im8-stone/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-im8-stone/20">
          <p className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.12em]">Creators in this batch</p>
        </div>

        <div className="divide-y divide-im8-stone/20">
          {deals.map((d, idx) => {
            const monthlyUsd = d.monthly_rate_cents ? d.monthly_rate_cents / 100 : null;
            const totalUsd = monthlyUsd !== null && d.total_months ? monthlyUsd * d.total_months : null;
            const decision = perDealDecision[d.id] ?? null;
            const isOpen = !!expanded[d.id];
            const comment = perDealComment[d.id] ?? "";

            const handle = d.instagram_handle || d.tiktok_handle || d.youtube_handle;
            const handleUrl = d.instagram_handle
              ? `https://instagram.com/${d.instagram_handle.replace(/^@/, "")}`
              : d.tiktok_handle
              ? `https://tiktok.com/@${d.tiktok_handle.replace(/^@/, "")}`
              : d.youtube_handle
              ? `https://youtube.com/@${d.youtube_handle.replace(/^@/, "")}`
              : null;

            return (
              <div key={d.id} id={`creator-${d.id}`} className="px-6 py-5 space-y-4">
                {/* Top row: name + meta + decision pill if chosen */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-im8-maroon text-lg" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                        {d.influencer_name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[6px] bg-im8-burgundy/10 text-im8-burgundy font-semibold">
                        Contract {d.contract_sequence ?? 1}
                      </span>
                      <span className="text-[11px] text-im8-burgundy/40">#{idx + 1} of {deals.length}</span>
                    </div>
                    <p className="text-xs text-im8-burgundy/60 mt-1 capitalize">
                      {d.platform_primary ?? "—"}
                      {d.agency_name && ` · ${d.agency_name}`}
                      {handleUrl && handle && (
                        <>
                          {" · "}
                          <a href={handleUrl} target="_blank" rel="noopener noreferrer" className="text-im8-red hover:underline">
                            @{handle.replace(/^@/, "")} ↗
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  {monthlyUsd !== null && (
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-im8-maroon" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                        ${monthlyUsd.toLocaleString()}<span className="text-xs font-normal text-im8-burgundy/50">/mo</span>
                      </p>
                      {totalUsd !== null && (
                        <p className="text-[11px] text-im8-burgundy/50">${totalUsd.toLocaleString()} over {d.total_months} mo</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Decision buttons — most prominent action */}
                <div className="grid grid-cols-3 gap-2">
                  {DECISION_BUTTONS.map(b => (
                    <button
                      key={b.kind}
                      type="button"
                      onClick={() => setDecision(d.id, b.kind)}
                      className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${decision === b.kind ? b.activeClass : b.idleClass}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* Per-creator comment */}
                <textarea
                  value={comment}
                  onChange={e => setPerDealComment(p => ({ ...p, [d.id]: e.target.value }))}
                  rows={2}
                  placeholder={
                    decision === "approval" ? "Optional note for this approval…" :
                    decision === "rejection" ? "Why are you rejecting this creator?" :
                    decision === "revision_request" ? "What changes would you like to see?" :
                    "Comment for this creator (optional)…"
                  }
                  className="w-full px-3 py-2 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
                />

                {/* Collapsible details */}
                <button
                  type="button"
                  onClick={() => toggleExpand(d.id)}
                  className="text-xs text-im8-red hover:underline font-medium inline-flex items-center gap-1"
                >
                  {isOpen ? "▲ Hide details" : "▼ Show full proposal details"}
                </button>

                {isOpen && (
                  <div className="bg-im8-offwhite rounded-xl px-4 py-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">Deliverables</p>
                      <p className="text-sm text-im8-burgundy/80">{formatDeliverablesSummary(d.deliverables)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">Duration</p>
                        <p className="text-sm font-semibold text-im8-burgundy">{d.total_months ?? 3} month{(d.total_months ?? 3) === 1 ? "" : "s"}</p>
                      </div>
                      {totalUsd !== null && (
                        <div>
                          <p className="text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">Total contract value</p>
                          <p className="text-sm font-semibold text-im8-burgundy">${totalUsd.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    {d.rationale && (
                      <div className="border-l-2 border-im8-red/40 pl-3">
                        <p className="text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">Rationale</p>
                        <p className="text-sm text-im8-burgundy/80 whitespace-pre-wrap leading-relaxed">{d.rationale}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Existing comments thread */}
      {existingComments.length > 0 && (
        <div className="bg-white rounded-2xl border border-im8-stone/30 px-6 py-5">
          <p className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.12em] mb-3">Comments so far</p>
          <div className="space-y-3">
            {existingComments.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-im8-sand flex items-center justify-center text-xs font-bold text-im8-burgundy shrink-0">
                  {c.author_display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-semibold text-im8-burgundy">{c.author_display_name || "Admin"}</span>
                    {c.kind !== "comment" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        c.kind === "approval" ? "bg-green-100 text-green-700" :
                        c.kind === "rejection" ? "bg-red-100 text-red-600" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {c.kind === "approval" ? "Approved" : c.kind === "rejection" ? "Rejected" : "Revision requested"}
                      </span>
                    )}
                    <span className="text-[11px] text-im8-burgundy/40">
                      {new Date(c.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-im8-burgundy/80 whitespace-pre-wrap leading-relaxed">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom: name + general comment + submit */}
      <div className="bg-white rounded-2xl border border-im8-stone/30 p-6 space-y-5">
        <h2 className="text-base font-semibold text-im8-burgundy">Submit your review</h2>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <label className="block text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">Your name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Rob"
            className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">
            General comment for the whole batch <span className="text-im8-burgundy/40 normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={generalComment}
            onChange={e => setGeneralComment(e.target.value)}
            rows={3}
            placeholder="Anything you'd like the IM8 team to know about the batch overall…"
            className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-3 bg-im8-burgundy text-white text-sm font-semibold rounded-lg hover:bg-im8-red transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit review →"}
        </button>

        <p className="text-xs text-im8-burgundy/40 text-center">
          Your decisions and comments appear immediately in the IM8 portal.
        </p>
      </div>
    </div>
  );
}
