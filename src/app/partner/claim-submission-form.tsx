"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Manual claim form — last-resort lookup if the auto-match heuristics on the
 * partner page failed. The creator types whatever email or name they used
 * when submitting; on submit we navigate back to /partner?claim=... where the
 * server-side logic links any matching discovery_profiles row to their
 * profile id.
 */
export default function ClaimSubmissionForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    router.push(`/partner?claim=${encodeURIComponent(v)}`);
  }

  return (
    <div className="bg-white rounded-xl border border-im8-stone/30 p-6">
      <h2 className="text-sm font-bold text-im8-burgundy">Already submitted with a different email?</h2>
      <p className="text-xs text-im8-burgundy/60 mt-1 mb-4">
        Type the email or name you used when submitting and we&rsquo;ll link the profile to your account.
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="email@example.com or your name"
          className="flex-1 px-3 py-2 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="px-4 py-2 bg-im8-burgundy text-white text-sm font-medium rounded-lg hover:bg-im8-red transition-colors disabled:opacity-50"
        >
          {busy ? "Looking up…" : "Find my submission"}
        </button>
      </form>
      <p className="text-[11px] text-im8-burgundy/40 mt-2">
        We match against the email or name on the original submission, so case and spacing don&rsquo;t need to be exact.
      </p>
    </div>
  );
}
