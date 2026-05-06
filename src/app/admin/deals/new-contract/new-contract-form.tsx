"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DELIVERABLE_LABELS } from "@/lib/deliverables";

type Deliverable = { code: string; count: number };

const STANDARD_USAGE_RIGHTS = ["Whitelisting", "Paid ad usage rights", "Link in bio"];

export default function NewContractForm({
  sourceDealId,
  nextSequence,
  initialRateUsd,
  initialMonths,
  initialDeliverables,
  canViewRates = false,
}: {
  sourceDealId: string;
  nextSequence: number;
  initialRateUsd: number | null;
  initialMonths: number;
  initialDeliverables: Deliverable[];
  canViewRates?: boolean;
}) {
  const router = useRouter();
  const [rate, setRate] = useState(initialRateUsd ? String(initialRateUsd) : "");
  const [months, setMonths] = useState(String(initialMonths));
  const [deliverables, setDeliverables] = useState<Deliverable[]>(
    initialDeliverables.length > 0 ? initialDeliverables : [{ code: "IGR", count: 3 }]
  );
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const parsedRate = rate ? parseFloat(rate) : 0;
  const parsedMonths = parseInt(months) || 3;
  const totalFee = parsedRate * parsedMonths;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!rate || parsedRate <= 0) {
      setError("Monthly rate is required.");
      return;
    }
    if (!parsedMonths || parsedMonths <= 0) {
      setError("Duration must be at least 1 month.");
      return;
    }
    if (deliverables.length === 0) {
      setError("Add at least one deliverable.");
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/deals/${sourceDealId}/new-contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rate_usd: parsedRate,
        total_months: parsedMonths,
        deliverables,
        rationale: rationale.trim() || null,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok || !data.deal_id) {
      setError(data.error || "Failed to create contract. Please try again.");
      return;
    }

    router.push(`/admin/deals/${data.deal_id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-5">
      <div>
        <div className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide mb-3">
          Contract {nextSequence} terms
        </div>

        {/* Rate + Duration */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Monthly rate (USD) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-im8-burgundy/50">$</span>
              <input
                type="number" min="0" value={rate} required
                onChange={e => setRate(e.target.value)}
                placeholder="3000"
                className="w-full pl-7 pr-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Duration *</label>
            <div className="relative">
              <input
                type="number" min="1" max="24" value={months} required
                onChange={e => setMonths(e.target.value)}
                className="w-full pl-3 pr-14 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-im8-burgundy/50 pointer-events-none">
                month{parsedMonths === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
        {canViewRates && parsedRate > 0 && (
          <p className="text-xs text-im8-burgundy/60 mt-2">
            Total fee: <span className="font-semibold text-im8-burgundy">${totalFee.toLocaleString()}</span> over {parsedMonths} month{parsedMonths === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* Deliverables */}
      <div>
        <label className="block text-sm font-medium text-im8-burgundy mb-2">Deliverables *</label>
        <div className="space-y-2">
          {deliverables.map((d, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={d.code}
                onChange={e => setDeliverables(prev => prev.map((x, i) => i === idx ? { ...x, code: e.target.value } : x))}
                className="flex-1 px-2 py-1.5 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none bg-white"
              >
                {["IGR","IGS","IG_POST","TIKTOK","YT_DEDICATED","YT_INTEGRATED","YT_PODCAST","YT_SHORTS","UGC","PODCAST_AD","NEWSLETTER","BLOG","EVENT","PRODUCTION_DAY","MEDIA_INTERVIEW"].map(c => (
                  <option key={c} value={c}>{DELIVERABLE_LABELS[c] ?? c}</option>
                ))}
              </select>
              <input
                type="number" min="1" max="20" value={d.count}
                onChange={e => setDeliverables(prev => prev.map((x, i) => i === idx ? { ...x, count: parseInt(e.target.value) || 1 } : x))}
                className="w-16 px-2 py-1.5 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy text-center focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setDeliverables(prev => prev.filter((_, i) => i !== idx))}
                className="text-im8-burgundy/40 hover:text-red-500 text-lg leading-none px-1"
                aria-label="Remove deliverable"
              >×</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDeliverables(prev => [...prev, { code: "IGR", count: 1 }])}
            className="text-xs text-im8-red hover:text-im8-burgundy font-medium"
          >+ Add deliverable</button>
        </div>

        <div className="mt-3 text-xs text-im8-burgundy/60">
          Usage rights (standard inclusions): {STANDARD_USAGE_RIGHTS.join(" · ")}
        </div>
      </div>

      {/* Rationale */}
      <div>
        <label className="block text-sm font-medium text-im8-burgundy mb-1">
          Rationale / notes <span className="text-im8-burgundy/40 font-normal">(optional)</span>
        </label>
        <textarea
          value={rationale}
          onChange={e => setRationale(e.target.value)}
          rows={3}
          placeholder="Why are we renewing? Performance notes from Contract 1, revised scope, etc."
          className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating…" : `Create Contract ${nextSequence} & send to Approvals →`}
        </button>
      </div>
    </form>
  );
}
