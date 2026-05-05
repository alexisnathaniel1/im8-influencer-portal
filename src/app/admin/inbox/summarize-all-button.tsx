"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SummarizeAllButton({ pendingCount }: { pendingCount: number }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/inbox/summarize-all?limit=50", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Failed: ${data.error ?? "unknown error"}`);
      } else {
        setMessage(
          data.processed === 0
            ? "Already up to date"
            : `Summarized ${data.succeeded}/${data.processed}${data.failed ? ` (${data.failed} failed)` : ""}${data.remaining ? " — click again for more" : ""}`
        );
        router.refresh();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(null), 6000);
    }
  }

  if (pendingCount === 0 && !message) return null;

  return (
    <div className="flex items-center gap-3">
      {pendingCount > 0 && (
        <button
          onClick={run}
          disabled={busy}
          className="text-[11px] font-bold uppercase tracking-[0.1em] px-3 py-1.5 rounded-full bg-im8-burgundy text-white hover:bg-im8-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {busy && <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
          {busy ? "Summarizing…" : `✦ Summarize ${pendingCount} ${pendingCount === 1 ? "email" : "emails"}`}
        </button>
      )}
      {message && (
        <span className="text-[11px] text-im8-muted">{message}</span>
      )}
    </div>
  );
}
