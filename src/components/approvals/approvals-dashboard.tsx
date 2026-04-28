"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDeliverablesSummary } from "@/lib/deliverables";

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
  deliverables?: Array<{ code: string; count: number }> | null;
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
  partially_approved: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

export default function ApprovalsDashboard({
  readyDeals,
  packets,
  packetDeals,
  approvers,
  canViewRates = true,
  userId,
}: {
  readyDeals: Deal[];
  packets: Packet[];
  packetDeals: Deal[];
  approvers: Approver[];
  canViewRates?: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Ready-for-approval state
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);
  const [editedRationales, setEditedRationales] = useState<Record<string, string>>({});
  const [savingRationaleId, setSavingRationaleId] = useState<string | null>(null);

  // Batch-creation form state
  const [batchTitle, setBatchTitle] = useState(
    `${new Date().toLocaleString("default", { month: "long", year: "numeric" })} Batch`
  );
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>(approvers.map((a) => a.id));
  const [batchNote, setBatchNote] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Side-panel state
  const [openPacket, setOpenPacket] = useState<Packet | null>(null);
  const [comments, setComments] = useState<ApprovalComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [generalComment, setGeneralComment] = useState("");
  const [postingGeneral, setPostingGeneral] = useState(false);
  const [perDealComment, setPerDealComment] = useState<Record<string, string>>({});
  const [perDealBusy, setPerDealBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"approve" | "reject" | null>(null);
  const [deletingPacketId, setDeletingPacketId] = useState<string | null>(null);

  const dealsById = useMemo(() => {
    const map: Record<string, Deal> = {};
    for (const d of [...readyDeals, ...packetDeals]) map[d.id] = d;
    return map;
  }, [readyDeals, packetDeals]);

  function toggleDeal(id: string) {
    setSelectedDealIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleAllDeals() {
    setSelectedDealIds(prev => prev.length === readyDeals.length ? [] : readyDeals.map(d => d.id));
  }
  function toggleApprover(id: string) {
    setSelectedApprovers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  // Auto-save rationale on blur
  async function saveRationale(dealId: string) {
    const value = editedRationales[dealId];
    if (value === undefined) return;
    const original = readyDeals.find(d => d.id === dealId)?.rationale ?? "";
    if (value === original) return;
    setSavingRationaleId(dealId);
    await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rationale: value || null }),
    });
    setSavingRationaleId(null);
    startTransition(() => router.refresh());
  }

  async function createPacket() {
    if (!selectedDealIds.length || !selectedApprovers.length || !batchTitle.trim()) return;
    setCreating(true);
    const res = await fetch("/api/approvals/create-packet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: batchTitle,
        dealIds: selectedDealIds,
        approverIds: selectedApprovers,
        batchNote: batchNote.trim() || null,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to create batch.");
      return;
    }
    setSelectedDealIds([]);
    setBatchNote("");
    setShowCreateForm(false);
    startTransition(() => router.refresh());
  }

  async function openPacketPanel(packet: Packet) {
    setOpenPacket(packet);
    setLoadingComments(true);
    setPerDealComment({});
    const res = await fetch(`/api/approvals/${packet.id}/comments`);
    const data = await res.json().catch(() => ({ comments: [] }));
    setComments(data.comments ?? []);
    setLoadingComments(false);
  }

  async function postGeneralComment() {
    if (!openPacket || !generalComment.trim()) return;
    setPostingGeneral(true);
    await fetch(`/api/approvals/${openPacket.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: generalComment, kind: "comment" }),
    });
    const res = await fetch(`/api/approvals/${openPacket.id}/comments`);
    const data = await res.json().catch(() => ({ comments: [] }));
    setComments(data.comments ?? []);
    setGeneralComment("");
    setPostingGeneral(false);
  }

  async function decideDeal(dealId: string, decision: "approved" | "rejected") {
    if (!openPacket) return;
    setPerDealBusy(`${dealId}:${decision}`);
    const comment = perDealComment[dealId] ?? "";
    await fetch(`/api/approvals/${openPacket.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approverId: userId,
        decisions: { [dealId]: { decision, comment } },
      }),
    });
    // Refresh comment thread (includes the per-deal note as a comment)
    if (comment.trim()) {
      const dealName = dealsById[dealId]?.influencer_name ?? "creator";
      await fetch(`/api/approvals/${openPacket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: `[${dealName}] ${decision === "approved" ? "✓ Approved" : "✗ Rejected"}: ${comment}`,
          kind: "comment",
        }),
      });
    }
    const res = await fetch(`/api/approvals/${openPacket.id}/comments`);
    const data = await res.json().catch(() => ({ comments: [] }));
    setComments(data.comments ?? []);
    setPerDealComment(p => ({ ...p, [dealId]: "" }));
    setPerDealBusy(null);
    startTransition(() => router.refresh());
  }

  async function bulkDecide(decision: "approved" | "rejected") {
    if (!openPacket) return;
    setBulkBusy(decision === "approved" ? "approve" : "reject");
    const decisions: Record<string, { decision: string; comment: string }> = {};
    for (const dealId of openPacket.deal_ids) {
      decisions[dealId] = { decision, comment: "" };
    }
    await fetch(`/api/approvals/${openPacket.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approverId: userId, decisions }),
    });
    const res = await fetch(`/api/approvals/${openPacket.id}/comments`);
    const data = await res.json().catch(() => ({ comments: [] }));
    setComments(data.comments ?? []);
    setBulkBusy(null);
    startTransition(() => router.refresh());
  }

  async function deletePacket(packet: Packet, e?: React.MouseEvent) {
    e?.stopPropagation();
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

  function rationaleValue(d: Deal) {
    return editedRationales[d.id] ?? d.rationale ?? "";
  }

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* ───────── LEFT — Ready for approval ───────── */}
      <div className="col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-im8-burgundy">
            Ready for approval ({readyDeals.length})
          </h2>
          {readyDeals.length > 0 && (
            <button onClick={toggleAllDeals} className="text-xs text-im8-red hover:underline">
              {selectedDealIds.length === readyDeals.length ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {readyDeals.length === 0 ? (
          <div className="bg-white rounded-xl border border-im8-stone/30 p-8 text-center text-im8-burgundy/40 text-sm">
            No deals ready for approval. Approve a creator from Discovery and they&rsquo;ll appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {readyDeals.map((d) => {
              const checked = selectedDealIds.includes(d.id);
              const monthlyUsd = d.monthly_rate_cents ? d.monthly_rate_cents / 100 : null;
              const totalUsd = monthlyUsd !== null && d.total_months ? monthlyUsd * d.total_months : null;
              return (
                <div
                  key={d.id}
                  className={`bg-white rounded-xl border p-4 transition-colors ${checked ? "border-im8-red bg-im8-offwhite" : "border-im8-stone/30"}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDeal(d.id)}
                      className="mt-1 accent-im8-red"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/admin/deals/${d.id}`}
                          className="font-semibold text-im8-red text-sm underline decoration-im8-red/40 underline-offset-2 hover:decoration-im8-red"
                        >
                          {d.influencer_name} ↗
                        </Link>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-[6px] bg-im8-burgundy/10 text-im8-burgundy font-semibold">
                          Contract {d.contract_sequence ?? 1}
                        </span>
                        <span className="text-xs text-im8-burgundy/50 capitalize">{d.platform_primary}</span>
                        {d.agency_name && <span className="text-xs text-im8-burgundy/50">· {d.agency_name}</span>}
                      </div>

                      {canViewRates && (
                        <div className="text-xs text-im8-burgundy/70">
                          {monthlyUsd !== null ? `$${monthlyUsd.toLocaleString()}/mo` : "Rate TBC"}
                          {d.total_months ? ` · ${d.total_months}mo` : ""}
                          {totalUsd !== null ? ` · $${totalUsd.toLocaleString()} total` : ""}
                        </div>
                      )}

                      {(d.deliverables ?? []).length > 0 && (
                        <p className="text-[11px] text-im8-burgundy/50">
                          {formatDeliverablesSummary(d.deliverables ?? null)}
                        </p>
                      )}

                      {/* Inline rationale editor */}
                      <div>
                        <label className="block text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">
                          Rationale for management
                          {savingRationaleId === d.id && <span className="ml-2 text-im8-red/60 normal-case">Saving…</span>}
                        </label>
                        <textarea
                          rows={2}
                          value={rationaleValue(d)}
                          onChange={(e) => setEditedRationales(p => ({ ...p, [d.id]: e.target.value }))}
                          onBlur={() => saveRationale(d.id)}
                          placeholder="Why this creator? Niche fit, audience quality, past results…"
                          className="w-full px-2 py-1.5 text-xs border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedDealIds.length > 0 && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full py-2.5 bg-im8-burgundy text-white text-sm font-medium rounded-lg hover:bg-im8-red transition-colors"
          >
            Send {selectedDealIds.length} creator{selectedDealIds.length === 1 ? "" : "s"} to management →
          </button>
        )}

        {showCreateForm && (
          <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-4">
            <h3 className="font-semibold text-im8-burgundy text-sm">Send batch to management</h3>

            <div>
              <label className="block text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">Batch title</label>
              <input
                type="text"
                value={batchTitle}
                onChange={(e) => setBatchTitle(e.target.value)}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">Send to</label>
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

            <div>
              <label className="block text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">
                Note to management <span className="text-im8-burgundy/40 normal-case font-normal">(optional, included in the email)</span>
              </label>
              <textarea
                rows={3}
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder="Add any general context or a summary for this batch…"
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={createPacket}
                disabled={creating || !selectedApprovers.length}
                className="flex-1 py-2 bg-im8-burgundy text-white text-sm rounded-lg hover:bg-im8-red disabled:opacity-50 transition-colors"
              >
                {creating ? "Sending…" : `Send ${selectedDealIds.length} to management`}
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

      {/* ───────── RIGHT — Approval batches ───────── */}
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PACKET_STATUS_COLORS[p.status] ?? ""}`}>
                        {p.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-xs text-im8-burgundy/50 mt-1">
                      {p.deal_ids.length} creator{p.deal_ids.length !== 1 ? "s" : ""} · {p.approved_count} approved · {p.rejected_count} rejected
                    </div>
                    <div className="text-xs text-im8-burgundy/40 mt-0.5">
                      Sent {new Date(p.created_at).toLocaleDateString()} by {p.created_by?.full_name ?? "—"}
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

      {/* ───────── SIDE PANEL — packet detail with per-creator decisions ───────── */}
      {openPacket && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setOpenPacket(null)} />
          <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-im8-stone/20 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-im8-burgundy truncate">{openPacket.title}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PACKET_STATUS_COLORS[openPacket.status] ?? ""}`}>
                    {openPacket.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-im8-burgundy/50">
                    {openPacket.approved_count} approved · {openPacket.rejected_count} rejected · {openPacket.deal_ids.length} total
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => deletePacket(openPacket, e)}
                  disabled={deletingPacketId === openPacket.id}
                  className="text-sm text-im8-burgundy/30 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  🗑 Delete
                </button>
                <button
                  onClick={() => setOpenPacket(null)}
                  className="text-im8-burgundy/40 hover:text-im8-burgundy text-2xl leading-none"
                >×</button>
              </div>
            </div>

            {/* Bulk actions */}
            <div className="px-6 py-3 border-b border-im8-stone/20 bg-im8-offwhite flex gap-2 flex-wrap">
              <button
                onClick={() => bulkDecide("approved")}
                disabled={bulkBusy !== null}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {bulkBusy === "approve" ? "Approving…" : `✓ Approve all (${openPacket.deal_ids.length})`}
              </button>
              <button
                onClick={() => bulkDecide("rejected")}
                disabled={bulkBusy !== null}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {bulkBusy === "reject" ? "Rejecting…" : "✗ Reject all"}
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Per-creator cards with individual decisions */}
              <div className="px-6 py-4 space-y-4">
                <p className="text-[10px] font-bold text-im8-muted uppercase tracking-[0.12em]">Creators in this batch</p>
                {openPacket.deal_ids.map((dealId) => {
                  const d = dealsById[dealId];
                  if (!d) return (
                    <div key={dealId} className="bg-white rounded-xl border border-im8-stone/30 p-4 text-sm text-im8-burgundy/60">
                      <Link href={`/admin/deals/${dealId}`} className="text-im8-red hover:underline">View deal →</Link>
                    </div>
                  );
                  const monthlyUsd = d.monthly_rate_cents ? d.monthly_rate_cents / 100 : null;
                  const totalUsd = monthlyUsd !== null && d.total_months ? monthlyUsd * d.total_months : null;
                  const note = perDealComment[dealId] ?? "";
                  return (
                    <div key={dealId} className="bg-white rounded-xl border border-im8-stone/40 p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <Link
                            href={`/admin/deals/${d.id}`}
                            className="font-semibold text-im8-red underline decoration-im8-red/40 underline-offset-2 hover:decoration-im8-red inline-flex items-center gap-2"
                            onClick={() => setOpenPacket(null)}
                          >
                            {d.influencer_name} ↗
                            <span className="text-[10px] px-1.5 py-0.5 rounded-[6px] bg-im8-burgundy/10 text-im8-burgundy font-semibold no-underline">
                              Contract {d.contract_sequence ?? 1}
                            </span>
                          </Link>
                          <div className="text-xs text-im8-burgundy/50 mt-0.5 capitalize">
                            {d.platform_primary}
                            {d.agency_name && ` · ${d.agency_name}`}
                          </div>
                        </div>
                        {canViewRates && monthlyUsd !== null && (
                          <div className="text-right">
                            <p className="text-sm font-bold text-im8-burgundy">${monthlyUsd.toLocaleString()}/mo</p>
                            {totalUsd !== null && (
                              <p className="text-[11px] text-im8-burgundy/50">${totalUsd.toLocaleString()} over {d.total_months} mo</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Deliverables */}
                      {(d.deliverables ?? []).length > 0 && (
                        <div className="text-xs">
                          <span className="text-im8-burgundy/40 uppercase tracking-wide font-medium">Deliverables: </span>
                          <span className="text-im8-burgundy/80">{formatDeliverablesSummary(d.deliverables ?? null)}</span>
                        </div>
                      )}

                      {/* Rationale */}
                      {d.rationale && (
                        <div className="border-l-2 border-im8-red/40 pl-3">
                          <p className="text-[10px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">Rationale</p>
                          <p className="text-xs text-im8-burgundy/80 whitespace-pre-wrap leading-relaxed">{d.rationale}</p>
                        </div>
                      )}

                      {/* Per-deal comment + actions */}
                      <div className="border-t border-im8-stone/20 pt-3 space-y-2">
                        <textarea
                          rows={2}
                          value={note}
                          onChange={(e) => setPerDealComment(p => ({ ...p, [dealId]: e.target.value }))}
                          placeholder="Comment for this creator (optional)…"
                          className="w-full px-2 py-1.5 text-xs border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => decideDeal(dealId, "approved")}
                            disabled={perDealBusy?.startsWith(dealId)}
                            className="flex-1 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {perDealBusy === `${dealId}:approved` ? "…" : "✓ Approve"}
                          </button>
                          <button
                            onClick={() => decideDeal(dealId, "rejected")}
                            disabled={perDealBusy?.startsWith(dealId)}
                            className="flex-1 py-1.5 border border-red-300 text-red-700 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            {perDealBusy === `${dealId}:rejected` ? "…" : "✗ Reject"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* General activity thread */}
              <div className="px-6 py-4 border-t border-im8-stone/20 bg-im8-offwhite/40 space-y-3">
                <p className="text-[10px] font-bold text-im8-muted uppercase tracking-[0.12em]">Batch activity & comments</p>
                {loadingComments ? (
                  <p className="text-sm text-im8-burgundy/40">Loading…</p>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-im8-burgundy/40">No comments yet.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="bg-white rounded-xl border border-im8-stone/30 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-im8-burgundy">{c.author_display_name || "Admin"}</span>
                        <span className="text-[11px] text-im8-burgundy/40">
                          {new Date(c.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap text-im8-burgundy/80">{c.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sticky footer — general comment */}
            <div className="px-6 py-4 border-t border-im8-stone/20 space-y-2 bg-white">
              <p className="text-[10px] font-bold text-im8-muted uppercase tracking-[0.12em]">Add a general comment for the batch</p>
              <textarea
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
                rows={2}
                placeholder="Visible in the batch thread…"
                className="w-full px-3 py-2 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
              />
              <button
                onClick={postGeneralComment}
                disabled={postingGeneral || !generalComment.trim()}
                className="px-4 py-1.5 bg-im8-burgundy text-white text-sm font-medium rounded-lg hover:bg-im8-red disabled:opacity-50 transition-colors"
              >
                {postingGeneral ? "Posting…" : "Post comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
