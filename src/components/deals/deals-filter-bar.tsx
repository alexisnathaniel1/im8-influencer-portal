"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const STATUSES = ["contacted", "negotiating", "agreed", "pending_approval", "approved", "contracted", "live", "completed", "declined", "rejected"];
const PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "other"];

export default function DealsFilterBar({ current }: {
  current: { q?: string; status?: string; platform?: string; type?: string; contractFrom?: string; contractTo?: string };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(current.q ?? "");

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = { q, ...current, ...patch };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    startTransition(() => router.push(`/admin/deals?${params.toString()}`));
  }

  function clear() {
    setQ("");
    startTransition(() => router.push("/admin/deals"));
  }

  const hasFilters = current.q || current.status || current.platform || current.type || current.contractFrom || current.contractTo;

  return (
    <div className="space-y-3">
      {/* Row 1: search + quick filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text" value={q} placeholder="Search by name or agency..."
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && update({ q })}
          className="flex-1 min-w-48 px-4 py-2 rounded-lg border border-im8-stone/40 text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
        />

        <select value={current.status ?? ""} onChange={e => update({ status: e.target.value })}
          className="px-3 py-2 rounded-lg border border-im8-stone/40 text-sm text-im8-burgundy focus:outline-none bg-white">
          <option value="">All statuses</option>
          {STATUSES.map(s => (
            <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>
          ))}
        </select>

        <select value={current.platform ?? ""} onChange={e => update({ platform: e.target.value })}
          className="px-3 py-2 rounded-lg border border-im8-stone/40 text-sm text-im8-burgundy focus:outline-none bg-white">
          <option value="">All platforms</option>
          {PLATFORMS.map(p => (
            <option key={p} value={p} className="capitalize">{p}</option>
          ))}
        </select>

        <select value={current.type ?? ""} onChange={e => update({ type: e.target.value })}
          className="px-3 py-2 rounded-lg border border-im8-stone/40 text-sm text-im8-burgundy focus:outline-none bg-white">
          <option value="">Paid & gifted</option>
          <option value="paid">Paid only</option>
          <option value="gifted">Gifted only</option>
        </select>

        {hasFilters && (
          <button onClick={clear}
            className="px-3 py-2 text-sm text-im8-burgundy/50 hover:text-im8-burgundy border border-im8-stone/30 rounded-lg transition-colors">
            Clear filters ✕
          </button>
        )}
      </div>

      {/* Row 2: contract date range */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-im8-burgundy/50 uppercase tracking-wide">Contract start</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-im8-burgundy/50">From</label>
          <input type="date" value={current.contractFrom ?? ""}
            onChange={e => update({ contractFrom: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-im8-stone/40 text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-im8-burgundy/50">To</label>
          <input type="date" value={current.contractTo ?? ""}
            onChange={e => update({ contractTo: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-im8-stone/40 text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
        </div>
      </div>
    </div>
  );
}
