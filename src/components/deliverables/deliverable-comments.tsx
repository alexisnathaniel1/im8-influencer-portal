"use client";

import { useEffect, useState } from "react";

type Comment = {
  id: string;
  deliverable_id: string;
  author_id: string;
  author_display_name: string;
  body: string;
  visible_to_partner: boolean;
  created_at: string;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function DeliverableComments({
  deliverableId,
  isAdminView = false,
  className = "",
}: {
  deliverableId: string;
  /** When true, shows the "Visible to partner" checkbox + the Internal/Partner-sees-this pills. */
  isAdminView?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [visibleToPartner, setVisibleToPartner] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchComments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments((data.comments as Comment[]) ?? []);
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    if (open && !loaded) fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, visibleToPartner: isAdminView ? visibleToPartner : true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to post comment");
      } else {
        setComments(prev => [...prev, data.comment as Comment]);
        setBody("");
        setVisibleToPartner(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setPosting(false);
    }
  }

  const count = loaded ? comments.length : null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs text-im8-burgundy/60 hover:text-im8-red transition-colors flex items-center gap-1"
      >
        <span>💬</span>
        <span>Comments{count !== null ? ` (${count})` : ""}</span>
        <span className="text-im8-burgundy/30">{open ? "▼" : "▶"}</span>
      </button>

      {open && (
        <div className="mt-2 pl-1 space-y-3">
          {loading && !loaded && (
            <p className="text-xs text-im8-burgundy/40 italic">Loading…</p>
          )}

          {loaded && comments.length === 0 && (
            <p className="text-xs text-im8-burgundy/40 italic">No comments yet.</p>
          )}

          {comments.length > 0 && (
            <ul className="space-y-2">
              {comments.map(c => (
                <li key={c.id} className="bg-im8-offwhite/60 border border-im8-stone/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold text-im8-burgundy">{c.author_display_name}</span>
                    <span className="text-[10px] text-im8-burgundy/40">{timeAgo(c.created_at)}</span>
                    {isAdminView && (
                      c.visible_to_partner
                        ? <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">Partner sees this</span>
                        : <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">Internal</span>
                    )}
                  </div>
                  <p className="text-xs text-im8-burgundy/80 whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          {/* Composer */}
          <form onSubmit={handlePost} className="space-y-1.5">
            <textarea
              value={body}
              onChange={e => { setBody(e.target.value); setError(null); }}
              rows={2}
              placeholder={isAdminView ? "Add a comment (internal by default)…" : "Reply to the team…"}
              className="w-full px-3 py-1.5 text-xs border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
            />
            <div className="flex items-center gap-3 flex-wrap">
              {isAdminView && (
                <label className="flex items-center gap-1.5 text-[11px] text-im8-burgundy/70">
                  <input
                    type="checkbox"
                    checked={visibleToPartner}
                    onChange={e => setVisibleToPartner(e.target.checked)}
                    className="w-3 h-3"
                  />
                  Visible to partner
                </label>
              )}
              <button
                type="submit"
                disabled={!body.trim() || posting}
                className="px-3 py-1 text-[11px] font-medium bg-im8-red text-white rounded-lg hover:bg-im8-burgundy disabled:opacity-40 transition-colors"
              >
                {posting ? "Posting…" : "Post"}
              </button>
              {error && <span className="text-[11px] text-red-600">{error}</span>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
