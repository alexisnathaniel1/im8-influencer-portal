"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DELIVERABLE_LABELS, BINARY_DELIVERABLE_CODES } from "@/lib/deliverables";

// Codes selectable in the creator counter-offer flow — content + rights.
// Sourced from the canonical registry so admin and creator UIs stay in sync.
const COUNTER_CODES = [
  "IGR", "IGS", "IG_POST", "TIKTOK",
  "YT_DEDICATED", "YT_INTEGRATED", "YT_PODCAST", "YT_SHORTS",
  "UGC", "PODCAST_AD", "NEWSLETTER", "APP_PARTNERSHIP", "BLOG",
  "EVENT", "PRODUCTION_DAY", "MEDIA_INTERVIEW",
  "WHITELIST", "PAID_AD", "RAW_FOOTAGE", "LINK_BIO",
];

type Deliverable = { code: string; count: number };

export default function NegotiationResponse({
  profileId,
  initialRate,
  initialMonths,
  initialDeliverables,
}: {
  profileId: string;
  initialRate: number | null;
  initialMonths: number;
  initialDeliverables: Deliverable[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accepted" | "declined" | "countered" | null>(null);
  const [showCounter, setShowCounter] = useState(false);

  // Counter form state — seeded from IM8's most recent terms so the
  // creator can tweak rather than start from scratch.
  const [rate, setRate] = useState(initialRate !== null ? String(initialRate) : "");
  const [months, setMonths] = useState(String(initialMonths || 3));
  const [deliverables, setDeliverables] = useState<Deliverable[]>(
    initialDeliverables.length > 0 ? initialDeliverables : [{ code: "IGR", count: 1 }]
  );
  const [note, setNote] = useState("");

  async function respond(response: "accepted" | "declined") {
    setBusy(response);
    await fetch(`/api/discovery/${profileId}/negotiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    setBusy(null);
    router.refresh();
  }

  async function sendCounter() {
    setBusy("countered");
    const rateNum = parseFloat(rate);
    const monthsNum = parseInt(months);
    await fetch(`/api/discovery/${profileId}/negotiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response: "countered",
        rate_usd: Number.isFinite(rateNum) ? rateNum : null,
        total_months: Number.isFinite(monthsNum) ? monthsNum : 3,
        deliverables: deliverables.filter(d => d.count > 0),
        note: note.trim() || null,
      }),
    });
    setBusy(null);
    setShowCounter(false);
    router.refresh();
  }

  if (showCounter) {
    return (
      <div className="bg-white rounded-xl border border-im8-stone/40 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-im8-burgundy">Send a counter back to IM8</p>
          <button onClick={() => setShowCounter(false)} className="text-im8-burgundy/40 hover:text-im8-burgundy text-sm">
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-im8-burgundy/70 mb-1">Monthly rate (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-im8-burgundy/40 text-sm">$</span>
              <input
                type="number" min="0" step="50" value={rate}
                onChange={e => setRate(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-im8-burgundy/70 mb-1">Duration (months)</label>
            <input
              type="number" min="1" max="24" value={months}
              onChange={e => setMonths(e.target.value)}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-im8-burgundy/70 mb-2">Deliverables</label>
          <div className="space-y-2">
            {deliverables.map((d, idx) => {
              const isBinary = BINARY_DELIVERABLE_CODES.has(d.code);
              return (
                <div key={`${d.code}-${idx}`} className="flex items-center gap-2">
                  <select
                    value={d.code}
                    onChange={e => {
                      const nextCode = e.target.value;
                      const nextIsBinary = BINARY_DELIVERABLE_CODES.has(nextCode);
                      setDeliverables(prev => prev.map((x, i) =>
                        i === idx ? { code: nextCode, count: nextIsBinary ? 1 : (BINARY_DELIVERABLE_CODES.has(x.code) ? 1 : x.count) } : x
                      ));
                    }}
                    className="flex-1 px-2 py-1.5 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none"
                  >
                    {COUNTER_CODES.map(c => (
                      <option key={c} value={c}>{DELIVERABLE_LABELS[c] ?? c}</option>
                    ))}
                  </select>
                  {isBinary ? (
                    <span className="w-16 px-2 py-1.5 text-xs text-im8-burgundy/60 text-center">Yes</span>
                  ) : (
                    <input
                      type="number" min="1" max="20" value={d.count}
                      onChange={e => setDeliverables(prev => prev.map((x, i) => i === idx ? { ...x, count: parseInt(e.target.value) || 1 } : x))}
                      className="w-16 px-2 py-1.5 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy text-center focus:outline-none"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setDeliverables(prev => prev.filter((_, i) => i !== idx))}
                    className="text-im8-burgundy/30 hover:text-red-500 text-lg leading-none px-1"
                  >×</button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setDeliverables(prev => [...prev, { code: "IGR", count: 1 }])}
              className="text-xs text-im8-red hover:underline font-medium"
            >+ Add deliverable</button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-im8-burgundy/70 mb-1">Note to IM8 <span className="text-im8-burgundy/40 font-normal">(optional)</span></label>
          <textarea
            value={note} onChange={e => setNote(e.target.value)}
            rows={3} placeholder="Add any context, reasoning, or terms you'd like the IM8 team to consider…"
            className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setShowCounter(false)}
            className="px-4 py-2 text-sm text-im8-burgundy hover:bg-im8-offwhite rounded-lg"
          >Cancel</button>
          <button
            onClick={sendCounter}
            disabled={busy !== null}
            className="px-4 py-2 bg-im8-burgundy text-white text-sm font-medium rounded-lg hover:bg-im8-red disabled:opacity-50 transition-colors"
          >
            {busy === "countered" ? "Sending…" : "Send counter to IM8"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        onClick={() => respond("accepted")}
        disabled={busy !== null}
        className="py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {busy === "accepted" ? "Saving…" : "Accept"}
      </button>
      <button
        onClick={() => setShowCounter(true)}
        disabled={busy !== null}
        className="py-2 bg-im8-burgundy text-white text-sm font-medium rounded-lg hover:bg-im8-red disabled:opacity-50 transition-colors"
      >
        Counter
      </button>
      <button
        onClick={() => respond("declined")}
        disabled={busy !== null}
        className="py-2 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {busy === "declined" ? "Saving…" : "Decline"}
      </button>
    </div>
  );
}
