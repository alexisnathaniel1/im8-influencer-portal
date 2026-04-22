"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Deal = { id: string; influencer_name: string; platform_primary: string; monthly_rate_cents: number | null; total_months: number | null; total_rate_cents: number | null; rationale: string | null; agency_name: string | null };
type Decision = { deal_id: string; decision: string; comment: string | null };
type Packet = { id: string; title: string; status: string; deal_ids: string[] };

export default function PacketReviewClient({
  packet, deals, myDecisions, approverId,
}: { packet: Packet; deals: Deal[]; myDecisions: Decision[]; approverId: string }) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<Record<string, { decision: string; comment: string }>>(() => {
    const init: Record<string, { decision: string; comment: string }> = {};
    myDecisions.forEach(d => { init[d.deal_id] = { decision: d.decision, comment: d.comment ?? "" }; });
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(myDecisions.length === deals.length);

  function setDecision(dealId: string, decision: string) {
    setDecisions(prev => ({ ...prev, [dealId]: { ...prev[dealId], decision, comment: prev[dealId]?.comment ?? "" } }));
  }

  function setComment(dealId: string, comment: string) {
    setDecisions(prev => ({ ...prev, [dealId]: { ...prev[dealId], decision: prev[dealId]?.decision ?? "", comment } }));
  }

  async function submitAll() {
    const undecided = deals.filter(d => !decisions[d.id]?.decision);
    if (undecided.length > 0) {
      alert(`Please decide on all ${undecided.length} remaining influencers before submitting.`);
      return;
    }
    setSubmitting(true);
    await fetch(`/api/approvals/${packet.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approverId, decisions }),
    });
    setSubmitted(true);
    router.refresh();
    setSubmitting(false);
  }

  const allDecided = deals.every(d => decisions[d.id]?.decision);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">{packet.title}</h1>
        <p className="text-im8-burgundy/60 mt-1">{deals.length} influencers for review</p>
      </div>

      {submitted && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-5 py-4 rounded-xl text-sm">
          Your decisions have been submitted. The IM8 team has been notified.
        </div>
      )}

      <div className="space-y-4">
        {deals.map(d => {
          const dec = decisions[d.id];
          const approved = dec?.decision === "approved";
          const rejected = dec?.decision === "rejected";

          return (
            <div key={d.id} className={`bg-white rounded-xl border p-6 space-y-4 transition-colors ${
              approved ? "border-green-300" : rejected ? "border-red-300" : "border-im8-stone/30"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-im8-burgundy text-lg">{d.influencer_name}</h3>
                  {d.agency_name && <p className="text-sm text-im8-burgundy/50">{d.agency_name}</p>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-im8-burgundy">
                    ${d.total_rate_cents ? (d.total_rate_cents / 100).toFixed(0) : "??"}
                  </div>
                  <div className="text-xs text-im8-burgundy/50">
                    ${d.monthly_rate_cents ? (d.monthly_rate_cents / 100).toFixed(0) : "??"}/mo × {d.total_months ?? 3}mo
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-im8-burgundy/60">
                <span className="capitalize bg-im8-sand px-2 py-1 rounded-full">{d.platform_primary}</span>
              </div>

              {d.rationale && (
                <div className="bg-im8-offwhite rounded-lg p-4">
                  <p className="text-sm text-im8-burgundy/80 font-medium mb-1">Why this influencer</p>
                  <p className="text-sm text-im8-burgundy/70">{d.rationale}</p>
                </div>
              )}

              {!submitted && (
                <>
                  <div className="flex gap-3">
                    <button onClick={() => setDecision(d.id, "approved")}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        approved ? "bg-green-500 text-white" : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}>
                      ✓ Approve
                    </button>
                    <button onClick={() => setDecision(d.id, "rejected")}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        rejected ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
                      }`}>
                      ✕ Reject
                    </button>
                  </div>
                  <input type="text" value={dec?.comment ?? ""} onChange={e => setComment(d.id, e.target.value)}
                    placeholder="Add a comment (optional)"
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                </>
              )}

              {submitted && dec && (
                <div className={`text-sm px-3 py-2 rounded-lg ${approved ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  You {dec.decision} this partnership{dec.comment ? `: "${dec.comment}"` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!submitted && (
        <div className="sticky bottom-6">
          <button onClick={submitAll} disabled={!allDecided || submitting}
            className="w-full py-4 bg-im8-red text-white font-semibold rounded-xl hover:bg-im8-burgundy disabled:opacity-40 transition-colors shadow-lg">
            {submitting ? "Submitting..." : `Submit all decisions (${Object.keys(decisions).length}/${deals.length} decided)`}
          </button>
        </div>
      )}
    </div>
  );
}
