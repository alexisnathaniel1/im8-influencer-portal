"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Deal = { id: string; influencer_name: string; agency_name: string | null; platform_primary: string; monthly_rate_cents: number | null; total_months: number | null; total_rate_cents: number | null; rationale: string | null };
type Packet = { id: string; title: string; status: string; deal_ids: string[]; created_at: string; created_by: { full_name: string } | null };
type Approver = { id: string; full_name: string; email: string };

const PACKET_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  partially_approved: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

export default function ApprovalsDashboard({ agreedDeals, packets, approvers }: {
  agreedDeals: Deal[]; packets: Packet[]; approvers: Approver[];
}) {
  const router = useRouter();
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);
  const [title, setTitle] = useState(`${new Date().toLocaleString("default", { month: "long", year: "numeric" })} Batch`);
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  function toggleDeal(id: string) {
    setSelectedDealIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleApprover(id: string) {
    setSelectedApprovers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function createPacket() {
    if (!selectedDealIds.length || !selectedApprovers.length || !title.trim()) return;
    setCreating(true);
    await fetch("/api/approvals/create-packet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dealIds: selectedDealIds, approverIds: selectedApprovers }),
    });
    router.refresh();
    setSelectedDealIds([]);
    setSelectedApprovers([]);
    setShowCreateForm(false);
    setCreating(false);
  }

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* Left: ready deals */}
      <div className="col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-im8-burgundy">Agreed — ready for approval ({agreedDeals.length})</h2>
          {selectedDealIds.length > 0 && (
            <button onClick={() => setShowCreateForm(true)}
              className="px-3 py-1.5 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors">
              Send for approval ({selectedDealIds.length})
            </button>
          )}
        </div>

        {agreedDeals.length === 0 ? (
          <div className="bg-white rounded-xl border border-im8-stone/30 p-8 text-center text-im8-burgundy/40 text-sm">
            No deals in &quot;agreed&quot; status yet.
          </div>
        ) : (
          <div className="space-y-2">
            {agreedDeals.map(d => (
              <label key={d.id} className={`flex items-start gap-3 bg-white rounded-xl border p-4 cursor-pointer transition-colors ${
                selectedDealIds.includes(d.id) ? "border-im8-red bg-im8-sand/30" : "border-im8-stone/30 hover:border-im8-stone"
              }`}>
                <input type="checkbox" checked={selectedDealIds.includes(d.id)} onChange={() => toggleDeal(d.id)}
                  className="mt-0.5 accent-im8-red" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-im8-burgundy text-sm">{d.influencer_name}</div>
                  <div className="text-xs text-im8-burgundy/50">
                    {d.platform_primary} · ${d.monthly_rate_cents ? (d.monthly_rate_cents / 100).toFixed(0) : "??"}/mo
                    · {d.total_months}mo total = ${d.total_rate_cents ? (d.total_rate_cents / 100).toFixed(0) : "??"}
                  </div>
                  {d.rationale && <p className="text-xs text-im8-burgundy/60 mt-1 line-clamp-2">{d.rationale}</p>}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Right: packets list */}
      <div className="col-span-3 space-y-4">
        <h2 className="font-semibold text-im8-burgundy">Sent for approval</h2>

        {/* Create approval form */}
        {showCreateForm && (
          <div className="bg-im8-sand/50 border border-im8-stone/40 rounded-xl p-5 space-y-4">
            <h3 className="font-medium text-im8-burgundy">Send for approval</h3>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-2">Select approvers *</label>
              {approvers.length === 0 ? (
                <p className="text-xs text-im8-burgundy/50">No approvers configured yet. Add them in <Link href="/admin/settings" className="underline">Settings</Link>.</p>
              ) : (
                <div className="space-y-2">
                  {approvers.map(a => (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={selectedApprovers.includes(a.id)} onChange={() => toggleApprover(a.id)}
                        className="accent-im8-red" />
                      <span className="text-sm text-im8-burgundy">{a.full_name} <span className="text-im8-burgundy/50">({a.email})</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-sm text-im8-burgundy/60 hover:text-im8-burgundy">
                Cancel
              </button>
              <button onClick={createPacket} disabled={creating || !selectedApprovers.length}
                className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
                {creating ? "Sending..." : `Send for approval (${selectedDealIds.length} deals)`}
              </button>
            </div>
          </div>
        )}

        {packets.length === 0 ? (
          <div className="bg-white rounded-xl border border-im8-stone/30 p-8 text-center text-im8-burgundy/40 text-sm">
            No approvals sent yet. Select agreed deals on the left and send them.
          </div>
        ) : (
          <div className="space-y-3">
            {packets.map(p => (
              <Link key={p.id} href={`/admin/approvals/${p.id}`}
                className="block bg-white rounded-xl border border-im8-stone/30 p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-im8-burgundy">{p.title}</h3>
                    <p className="text-xs text-im8-burgundy/50 mt-1">
                      {p.deal_ids.length} deals · by {(p.created_by as { full_name: string } | null)?.full_name ?? "Admin"}
                      · {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${PACKET_STATUS_COLORS[p.status] ?? ""}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
