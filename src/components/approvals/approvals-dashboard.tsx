"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Deal = {
  id: string;
  influencer_name: string;
  agency_name: string | null;
  platform_primary: string;
  monthly_rate_cents: number | null;
  total_months: number | null;
  total_rate_cents: number | null;
  rationale: string | null;
  contract_sequence: number | null;
};
type Packet = {
  id: string;
  title: string;
  status: string;
  deal_ids: string[];
  approver_ids: string[];
  approved_count: number;
  rejected_count: number;
  created_at: string;
  created_by: { full_name: string } | null;
};
type Approver = { id: string; full_name: string; email: string };
type ApprovalComment = {
  id: string;
  author_display_name: string;
  body: string;
  kind: string;
  created_at: string;
};

const PACKET_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  partially_approved: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

export default function ApprovalsDashboard({
  agreedDeals,
  packets,
  approvers,
  canViewRates = true,
  userId,
}: {
  agreedDeals: Deal[];
  packets: Packet[];
  approvers: Approver[];
  canViewRates?: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);
  const [title, setTitle] = useState(
    `${new Date().toLocaleString("default", { month: "long", year: "numeric" })} Batch`
  );
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>(
    approvers.map((a) => a.id)
  );
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deletingPacketId, setDeletingPacketId] = useState<string | null>(null);

  // Side panel state
  const [openPacket, setOpenPacket] = useState<Packet | null>(null);
  const [comments, setComments] = useState<ApprovalComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  function toggleDeal(id: string) {
    setSelectedDealIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleApprover(id: string) {
    setSelectedApprovers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function createPacket() {
    if (!selectedDealIds.length || !selectedApprovers.length || !title.trim()) return;
    setCreating(true);
    await fetch("/api/approvals/create-packet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        dealIds: selectedDealIds,
        approverIds: selectedApprovers,
      }),
    });
    startTransition(() => router.refresh());
    setSelectedDealIds([]);
    setShowCreateForm(false);
    setCreating(false);
  }

  async function openPacketPanel(packet: Packet) {
    setOpenPacket(packet);
    setLoadingComments(true);
    const res = await fetch(`/api/approvals/${packet.id}/comments`);
    const data = await res.json().catch(() => ({ comments: [] }));
    setComments(data.comments ?? []);
    setLoadingComments(false);
  }

  async function postComment(kind: "comment" | "approval" | "rejection" | "revision_request") {
    if (!openPacket) return;
    if (kind === "comment" && !commentBody.trim()) return;
    setPostingComment(true);

    // 1. Post the comment/thread entry (visible in side panel)
    await fetch(`/api/approvals/${openPacket.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody || kindLabel(kind), kind }),
    });

    // 2. For approval/rejection/revision actions, also submit a formal decision
    //    so the decide route can update deal status and packet counts.
    if (kind !== "comment") {
      const decisionMap: Record<string, string> = {
        approval: "approved",
        rejection: "rejected",
        revision_request: "revision_requested",
      };
      const decisionValue = decisionMap[kind];
      // Apply the same decision to every deal in this packet
      const decisions: Record<string, { decision: string; comment: string }> = {};
      for (const dealId of openPacket.deal_ids) {
        decisions[dealId] = { decision: decisionValue, comment: commentBody };
      }
      const decideRes = await fetch(`/api/approvals/${openPacket.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: userId, decisions }),
      });
      if (decideRes.ok) {
        const decideData = await decideRes.json().catch(() => ({}));
        // Update the open packet's counts optimistically so the panel header reflects them
        const updatedStatus = decideData.packetStatus as string | undefined;
        if (updatedStatus) {
          setOpenPacket(prev => prev ? {
            ...prev,
            status: updatedStatus,
            approved_count: kind === "approval" ? prev.approved_count + 1 : prev.approved_count,
            rejected_count: kind === "rejection" ? prev.rejected_count + 1 : prev.rejected_count,
          } : prev);
        }
      }
    }

    // 3. Refresh comment thread
    const res = await fetch(`/api/approvals/${openPacket.id}/comments`);
    const data = await res.json().catch(() => ({ comments: [] }));
    setComments(data.comments ?? []);
    setCommentBody("");
    setPostingComment(false);
    // Refresh page data (updates packet list counts and deals list)
    startTransition(() => router.refresh());
  }

  async function deletePacket(packet: Packet, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete approval batch "${packet.title}"? This cannot be undone.`)) return;
    setDeletingPacketId(packet.id);
    const res = await fetch(`/api/approvals/${packet.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete approval batch.");
    } else {
      if (openPacket?.id === packet.id) setOpenPacket(null);
      startTransition(() => router.refresh());
    }
    setDeletingPacketId(null);
  }

  function kindLabel(kind: string) {
    if (kind === "approval") return "✓ Approved this packet";
    if (kind === "rejection") return "✗ Rejected this packet";
    if (kind === "revision_request") return "⟳ Requested revisions";
    return "";
  }

  function kindStyle(kind: string) {
    if (kind === "approval") return "bg-green-50 border-green-200 text-green-800";
    if (kind === "rejection") return "bg-red-50 border-red-200 text-red-800";
    if (kind === "revision_request") return "bg-orange-50 border-orange-200 text-orange-800";
    return "bg-im8-offwhite border-im8-stone/30 text-im8-ink";
  }

  const dealsById = Object.fromEntries(agreedDeals.map((d) => [d.id, d]));

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* Left: ready deals */}
      <div className="col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-im8-burgundy">
            Ready for approval ({agreedDeals.length})
          </h2>
          {selectedDealIds.length > 0 && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1.5 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors"
            >
              Send for approval ({selectedDealIds.length})
            </button>
          )}
        </div>

        {agreedDeals.length === 0 ? (
          <div className="bg-white rounded-xl border border-im8-stone/30 p-8 text-center text-im8-burgundy/40 text-sm">
            No deals in &ldquo;agreed&rdquo; status yet.
          </div>
        ) : (
          <div className="space-y-2">
            {agreedDeals.map((d) => (
              <label
                key={d.id}
                className={`flex items-start gap-3 bg-white rounded-xl border p-4 cursor-pointer transition-colors ${
                  selectedDealIds.includes(d.id)
                    ? "border-im8-red bg-im8-offwhite"
                    : "border-im8-stone/30 hover:border-im8-stone/60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDealIds.includes(d.id)}
                  onChange={() => toggleDeal(d.id)}
                  className="mt-0.5 accent-im8-red"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-im8-burgundy text-sm">{d.influencer_name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-[6px] bg-purple-100 text-purple-700 font-semibold">
                      Contract {d.contract_sequence ?? 1}
                    </span>
                  </div>
                  <div className="text-xs text-im8-burgundy/50">
                    {d.platform_primary}
                    {canViewRates && d.monthly_rate_cents
                      ? ` · $${(d.monthly_rate_cents / 100).toFixed(0)}/mo`
                      : ""}
                    {d.total_months ? ` · ${d.total_months}mo` : ""}
                    {d.agency_name ? ` · ${d.agency_name}` : ""}
                  </div>
                  {d.rationale && (
                    <p className="text-xs text-im8-burgundy/60 mt-1 line-clamp-2 italic">
                      {d.rationale}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Create packet form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-4">
            <h3 className="font-semibold text-im8-burgundy text-sm">New approval batch</h3>
            <div>
              <label className="block text-xs font-medium text-im8-burgundy/60 mb-1 uppercase tracking-wide">
                Batch title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-im8-burgundy/60 mb-2 uppercase tracking-wide">
                Send to approvers
              </label>
              {approvers.length === 0 ? (
                <p className="text-xs text-im8-burgundy/40">No approvers set up yet.</p>
              ) : (
                <div className="space-y-1">
                  {approvers.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedApprovers.includes(a.id)}
                        onChange={() => toggleApprover(a.id)}
                        className="accent-im8-red"
                      />
                      <span className="text-sm text-im8-burgundy">{a.full_name}</span>
                      <span className="text-xs text-im8-burgundy/40">{a.email}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={createPacket}
                disabled={creating || !selectedApprovers.length}
                className="flex-1 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors"
              >
                {creating ? "Sending…" : `Send ${selectedDealIds.length} creator${selectedDealIds.length !== 1 ? "s" : ""} for approval`}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-2 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy/60 hover:text-im8-burgundy"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: existing packets */}
      <div className="col-span-3 space-y-4">
        <h2 className="font-semibold text-im8-burgundy">Approval batches ({packets.length})</h2>

        {packets.length === 0 ? (
          <div className="bg-white rounded-xl border border-im8-stone/30 p-8 text-center text-im8-burgundy/40 text-sm">
            No approval batches yet. Select creators on the left and send for approval.
          </div>
        ) : (
          <div className="space-y-3">
            {packets.map((p) => (
              <button
                key={p.id}
                onClick={() => openPacketPanel(p)}
                className="w-full bg-white rounded-xl border border-im8-stone/30 p-4 text-left hover:border-im8-red/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-im8-burgundy text-sm">{p.title}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PACKET_STATUS_COLORS[p.status] ?? ""}`}
                      >
                        {p.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-xs text-im8-burgundy/50 mt-1">
                      {p.deal_ids.length} creator{p.deal_ids.length !== 1 ? "s" : ""} ·{" "}
                      {p.approved_count} approved · {p.rejected_count} rejected ·{" "}
                      {p.approver_ids.length} approver{p.approver_ids.length !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-im8-burgundy/40 mt-0.5">
                      Sent {new Date(p.created_at).toLocaleDateString()} by{" "}
                      {p.created_by?.full_name ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => deletePacket(p, e)}
                      disabled={deletingPacketId === p.id}
                      title="Delete batch"
                      className="text-im8-burgundy/25 hover:text-red-600 hover:bg-red-50 text-sm px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      🗑
                    </button>
                    <span className="text-im8-burgundy/30 text-sm">→</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Side panel — packet thread */}
      {openPacket && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setOpenPacket(null)}
          />
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-im8-stone/20 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-im8-burgundy">{openPacket.title}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PACKET_STATUS_COLORS[openPacket.status] ?? ""}`}
                  >
                    {openPacket.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-im8-burgundy/50">
                    {openPacket.approved_count} approved · {openPacket.rejected_count} rejected
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => deletePacket(openPacket, e)}
                  disabled={deletingPacketId === openPacket.id}
                  title="Delete this batch"
                  className="text-sm text-im8-burgundy/30 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  🗑 Delete
                </button>
                <button
                  onClick={() => setOpenPacket(null)}
                  className="text-im8-burgundy/40 hover:text-im8-burgundy text-xl leading-none mt-0.5"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Creators in this packet */}
            <div className="px-6 py-3 border-b border-im8-stone/20 bg-im8-offwhite">
              <p className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide mb-2">
                Creators in this batch
              </p>
              <div className="space-y-1">
                {openPacket.deal_ids.map((dealId) => {
                  const d = dealsById[dealId];
                  return d ? (
                    <div key={dealId} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/admin/deals/${dealId}`}
                          className="text-sm font-medium text-im8-red hover:underline truncate"
                          onClick={() => setOpenPacket(null)}
                        >
                          {d.influencer_name}
                        </Link>
                        <span className="text-[11px] px-1.5 py-0.5 rounded-[6px] bg-purple-100 text-purple-700 font-semibold shrink-0">
                          Contract {d.contract_sequence ?? 1}
                        </span>
                      </div>
                      {canViewRates && (
                        <span className="text-xs text-im8-burgundy/50 shrink-0">
                          {d.monthly_rate_cents
                            ? `$${(d.monthly_rate_cents / 100).toFixed(0)}/mo${d.total_months ? ` × ${d.total_months}mo` : ""}`
                            : "—"}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div key={dealId}>
                      <Link
                        href={`/admin/deals/${dealId}`}
                        className="text-sm text-im8-red hover:underline"
                        onClick={() => setOpenPacket(null)}
                      >
                        View deal →
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comment thread */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <p className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">
                Thread
              </p>
              {loadingComments ? (
                <p className="text-sm text-im8-burgundy/40">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-im8-burgundy/40">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className={`border rounded-xl px-4 py-3 text-sm ${kindStyle(c.kind)}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs">{c.author_display_name || "Admin"}</span>
                      <span className="text-xs opacity-60">
                        {new Date(c.created_at).toLocaleString("en-AU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add comment + actions */}
            <div className="px-6 py-4 border-t border-im8-stone/20 space-y-3">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Leave a comment…"
                rows={2}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => postComment("comment")}
                  disabled={postingComment || !commentBody.trim()}
                  className="px-4 py-2 bg-im8-sand text-im8-burgundy text-sm rounded-lg hover:bg-im8-stone transition-colors disabled:opacity-40"
                >
                  Comment
                </button>
                <button
                  onClick={() => postComment("approval")}
                  disabled={postingComment}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => postComment("revision_request")}
                  disabled={postingComment}
                  className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-40"
                >
                  ⟳ Request revisions
                </button>
                <button
                  onClick={() => postComment("rejection")}
                  disabled={postingComment}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
                >
                  ✗ Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
