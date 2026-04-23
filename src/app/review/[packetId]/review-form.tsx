"use client";

import { useState } from "react";

const ACTIONS = [
  { kind: "approval", label: "Approve", color: "bg-green-600 hover:bg-green-700 text-white" },
  { kind: "revision_request", label: "Request changes", color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  { kind: "rejection", label: "Reject", color: "bg-red-600 hover:bg-red-700 text-white" },
  { kind: "comment", label: "Comment only", color: "bg-im8-burgundy/10 hover:bg-im8-burgundy/20 text-im8-burgundy" },
] as const;

export default function ReviewForm({
  packetId,
  token,
  defaultName,
  isClosed,
}: {
  packetId: string;
  token: string;
  defaultName: string;
  isClosed: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<string>("approval");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isClosed) {
    return (
      <div className="bg-white rounded-xl border border-im8-stone/20 p-6 text-center text-im8-burgundy/50 text-sm">
        This batch has already been finalised. No further responses needed.
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl border border-green-200 p-8 text-center">
        <div className="text-3xl mb-3">✓</div>
        <h2 className="text-lg font-semibold text-im8-burgundy mb-1">Response received</h2>
        <p className="text-sm text-im8-burgundy/60">
          Your {kind === "approval" ? "approval" : kind === "rejection" ? "rejection" : kind === "revision_request" ? "revision request" : "comment"} has been recorded and will appear in the portal.
        </p>
      </div>
    );
  }

  async function submit() {
    if (!name.trim() || !body.trim()) {
      setError("Please enter your name and a message.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/${packetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reviewerName: name, body, kind }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to submit"); return; }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-im8-stone/20 p-6 space-y-5">
      <h2 className="text-base font-semibold text-im8-burgundy">Leave your response</h2>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="block text-xs font-medium text-im8-burgundy/60 uppercase tracking-wide mb-1">Your name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Rob"
          className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-im8-burgundy/60 uppercase tracking-wide mb-2">Response type</label>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map(a => (
            <button
              key={a.kind}
              type="button"
              onClick={() => setKind(a.kind)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                kind === a.kind
                  ? a.color + " border-transparent"
                  : "border-im8-stone/30 text-im8-burgundy/60 hover:border-im8-stone/60"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-im8-burgundy/60 uppercase tracking-wide mb-1">Message</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={4}
          placeholder={
            kind === "approval" ? "Looks good — happy to approve." :
            kind === "rejection" ? "Not quite right because..." :
            kind === "revision_request" ? "I'd like to see changes to..." :
            "Your thoughts..."
          }
          className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
        />
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-3 bg-im8-burgundy text-white text-sm font-semibold rounded-lg hover:bg-im8-red transition-colors disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit response"}
      </button>

      <p className="text-xs text-im8-burgundy/40 text-center">
        Your response will appear immediately in the IM8 portal.
      </p>
    </div>
  );
}
