"use client";

import { useEffect, useState } from "react";

type Comment = {
  id: string;
  body: string;
  author_name: string;
  author_role: string;
  created_at: string;
  read_by_admin: boolean;
};

const ROLE_LABEL: Record<string, { label: string; classes: string }> = {
  creator:    { label: "You",    classes: "bg-im8-red text-white" },
  admin:      { label: "IM8",    classes: "bg-im8-burgundy text-white" },
  management: { label: "IM8",    classes: "bg-im8-burgundy text-white" },
  support:    { label: "IM8",    classes: "bg-im8-burgundy text-white" },
};

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function PartnerCommentThread({ briefId }: { briefId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/briefs/${briefId}/comments`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as { comments: Comment[] };
        if (!cancelled) setComments(data.comments ?? []);
      } catch {
        if (!cancelled) setError("Couldn't load comments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [briefId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/briefs/${briefId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send your message.");
      } else {
        setComments(prev => [...prev, data.comment]);
        setDraft("");
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-im8-stone/20 p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-im8-burgundy">Questions about this brief?</h2>
        <p className="text-xs text-im8-burgundy/50 mt-1">
          Leave a message for the IM8 team. They&apos;ll be notified and reply here.
        </p>
      </div>

      {/* Thread */}
      <div className="space-y-4 mb-5">
        {loading && (
          <p className="text-sm text-im8-burgundy/40 italic">Loading messages…</p>
        )}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-im8-burgundy/40 italic">No messages yet — start the conversation below.</p>
        )}
        {comments.map(c => {
          const meta = ROLE_LABEL[c.author_role] ?? ROLE_LABEL.creator;
          const isMine = c.author_role === "creator";
          return (
            <div key={c.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${meta.classes}`}>
                    {meta.label}
                  </span>
                  <span className="text-im8-burgundy/40">{c.author_name}</span>
                  <span className="text-im8-burgundy/30">· {relativeTime(c.created_at)}</span>
                </div>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  isMine
                    ? "bg-im8-red/10 text-im8-burgundy rounded-tr-sm"
                    : "bg-im8-offwhite text-im8-burgundy rounded-tl-sm"
                }`}>
                  {c.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="border-t border-im8-stone/15 pt-4">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          placeholder="Ask a question or share a note about this brief…"
          className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
        />
        {error && (
          <p className="text-xs text-red-700 mt-2">{error}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-im8-burgundy/40">{draft.length}/4000</span>
          <button
            type="submit"
            disabled={!draft.trim() || posting}
            className="px-4 py-2 bg-im8-red text-white text-[12px] font-bold uppercase tracking-[0.05em] rounded-full hover:bg-im8-burgundy transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {posting && <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            {posting ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
