"use client";

import { useState } from "react";

type Result = {
  total: number;
  created: number;
  failed: number;
  errors: Array<{ dealId: string; name: string; message: string }>;
};

export default function BulkFoldersButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (running) return;
    if (!confirm("Create Drive folders for every active partner that doesn't have one yet?\n\nThis can take a minute or two for the full roster.")) return;
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/bulk-create-folders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Bulk create failed");
      } else {
        setResult(data as Result);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-im8-stone/40 bg-white hover:bg-im8-offwhite hover:border-im8-stone/60 transition-colors text-sm text-im8-burgundy font-medium disabled:opacity-50"
      >
        {running && (
          <svg className="w-3.5 h-3.5 animate-spin text-im8-burgundy/60" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {running ? "Creating folders…" : "Create folders for all partners"}
      </button>
      {result && (
        <div className="text-[11px] text-right max-w-xs">
          {result.total === 0 ? (
            <span className="text-im8-burgundy/50">All partners already have folders.</span>
          ) : (
            <>
              <span className="text-emerald-700 font-medium">Created {result.created}</span>
              {result.failed > 0 && (
                <span className="text-amber-700 font-medium"> · {result.failed} failed</span>
              )}
              <span className="text-im8-burgundy/40"> of {result.total}</span>
              {result.errors.length > 0 && (
                <details className="mt-1 text-left bg-amber-50 border border-amber-200 rounded p-2">
                  <summary className="cursor-pointer text-amber-700">View errors</summary>
                  <ul className="mt-1 space-y-0.5">
                    {result.errors.slice(0, 10).map((e) => (
                      <li key={e.dealId} className="text-amber-800">
                        <span className="font-medium">{e.name}</span>: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      )}
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  );
}
