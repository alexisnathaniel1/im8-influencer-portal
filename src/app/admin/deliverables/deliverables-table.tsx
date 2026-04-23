"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Deliverable = {
  id: string;
  deliverable_type: string;
  platform: string;
  title: string | null;
  status: string;
  due_date: string | null;
  live_date: string | null;
  post_url: string | null;
  views: number | null;
  likes: number | null;
  comments_count: number | null;
  is_story: boolean;
  fee_cents: number | null;
  views_updated_at: string | null;
  deal: { id: string; influencer_name: string; platform_primary: string } | null;
  brief: { id: string; title: string } | null;
  pic: { id: string; full_name: string } | null;
  editor: { id: string; full_name: string } | null;
};

type Profile = { id: string; full_name: string };

const STATUS_OPTIONS = ["pending", "in_progress", "submitted", "approved", "live", "completed"];
const PLATFORM_OPTIONS = ["instagram", "tiktok", "youtube", "other"];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  live: "bg-emerald-100 text-emerald-700",
  completed: "bg-purple-100 text-purple-700",
};

export default function DeliverablesTable({
  deliverables,
  pics,
  editors,
  currentFilters,
  canViewRates = true,
}: {
  deliverables: Deliverable[];
  pics: Profile[];
  editors: Profile[];
  currentFilters: { status?: string; platform?: string; q?: string; month?: string };
  canViewRates?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function setFilter(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  }

  const selected = deliverables.find(d => d.id === selectedId) ?? null;

  return (
    <div className="flex gap-6">
      {/* Main table */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-im8-stone/30 p-4">
          <input
            type="text"
            placeholder="Search title..."
            defaultValue={currentFilters.q ?? ""}
            onBlur={e => setFilter("q", e.target.value)}
            onKeyDown={e => e.key === "Enter" && setFilter("q", (e.target as HTMLInputElement).value)}
            className="px-3 py-1.5 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 w-48"
          />
          <input
            type="month"
            defaultValue={currentFilters.month ?? ""}
            onChange={e => setFilter("month", e.target.value)}
            className="px-3 py-1.5 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
          />
          <select
            value={currentFilters.status ?? ""}
            onChange={e => setFilter("status", e.target.value)}
            className="px-3 py-1.5 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none bg-white"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>)}
          </select>
          <select
            value={currentFilters.platform ?? ""}
            onChange={e => setFilter("platform", e.target.value)}
            className="px-3 py-1.5 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none bg-white"
          >
            <option value="">All platforms</option>
            {PLATFORM_OPTIONS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
          </select>
          <div className="ml-auto text-xs text-im8-burgundy/50 self-center">{deliverables.length} rows</div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-im8-sand/50 border-b border-im8-stone/20">
              <tr>
                {["Influencer", "Type", "Status", "Due", "Post URL", "Views", "PIC"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-im8-stone/10">
              {deliverables.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-im8-burgundy/40">No deliverables yet. They auto-appear when a deal moves to Contracted.</td></tr>
              )}
              {deliverables.map(d => (
                <tr
                  key={d.id}
                  onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}
                  className={`cursor-pointer transition-colors hover:bg-im8-sand/30 ${selectedId === d.id ? "bg-im8-sand/50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-im8-burgundy truncate max-w-[140px]">
                      {d.deal?.influencer_name ?? "—"}
                    </div>
                    {d.brief && (
                      <Link href={`/admin/briefs/${d.brief.id}`} onClick={e => e.stopPropagation()}
                        className="text-xs text-im8-red hover:underline">
                        {d.brief.title}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-im8-sand px-2 py-0.5 rounded text-im8-burgundy">{d.deliverable_type}</span>
                    {d.is_story && <span className="ml-1 text-xs text-im8-burgundy/40">story</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect deliverableId={d.id} current={d.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-im8-burgundy/70">
                    {d.due_date ? new Date(d.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <PostUrlCell deliverableId={d.id} current={d.post_url} isStory={d.is_story} />
                  </td>
                  <td className="px-4 py-3">
                    <MetricsCell deliverable={d} />
                  </td>
                  <td className="px-4 py-3">
                    <PicSelect deliverableId={d.id} current={d.pic?.id ?? ""} pics={pics} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel */}
      {selected && (
        <div className="w-96 shrink-0">
          <DeliverablePanel deliverable={selected} editors={editors} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}

function StatusSelect({ deliverableId, current }: { deliverableId: string; current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);

  async function onChange(next: string) {
    setValue(next);
    await fetch(`/api/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${STATUS_COLORS[value] ?? "bg-gray-100 text-gray-600"}`}
    >
      {STATUS_OPTIONS.map(s => (
        <option key={s} value={s} className="capitalize bg-white text-im8-burgundy">{s.replace("_", " ")}</option>
      ))}
    </select>
  );
}

function PostUrlCell({ deliverableId, current, isStory }: { deliverableId: string; current: string | null; isStory: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current ?? "");

  async function save() {
    setEditing(false);
    await fetch(`/api/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_url: val || null }),
    });
    router.refresh();
  }

  if (editing) return (
    <input
      autoFocus
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => e.key === "Enter" && save()}
      onClick={e => e.stopPropagation()}
      placeholder="https://..."
      className="w-36 px-2 py-1 text-xs border border-im8-stone/40 rounded focus:outline-none"
    />
  );

  if (current) return (
    <a href={current} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="text-xs text-im8-red hover:underline truncate max-w-[100px] block">
      View ↗
    </a>
  );

  return (
    <button onClick={e => { e.stopPropagation(); setEditing(true); }}
      className="text-xs text-im8-burgundy/40 hover:text-im8-red">
      {isStory ? "Manual" : "+ Add URL"}
    </button>
  );
}

function MetricsCell({ deliverable }: { deliverable: Deliverable }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [views, setViews] = useState(String(deliverable.views ?? ""));

  async function saveViews() {
    setEditing(false);
    const v = parseInt(views);
    if (isNaN(v)) return;
    await fetch(`/api/deliverables/${deliverable.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ views: v }),
    });
    router.refresh();
  }

  if (deliverable.views === null && !deliverable.is_story) {
    return <span className="text-xs text-im8-burgundy/30">—</span>;
  }

  if (deliverable.is_story && editing) return (
    <input autoFocus value={views} onChange={e => setViews(e.target.value)}
      onBlur={saveViews} onKeyDown={e => e.key === "Enter" && saveViews()}
      onClick={e => e.stopPropagation()}
      className="w-20 px-2 py-1 text-xs border border-im8-stone/40 rounded focus:outline-none" />
  );

  if (deliverable.is_story) return (
    <button onClick={e => { e.stopPropagation(); setEditing(true); }}
      className="text-xs text-im8-burgundy/60 hover:text-im8-red">
      {deliverable.views !== null ? deliverable.views.toLocaleString() : "+ Views"}
    </button>
  );

  return (
    <div className="text-xs text-im8-burgundy/70 space-y-0.5">
      {deliverable.views !== null && <div>{deliverable.views.toLocaleString()} views</div>}
      {deliverable.likes !== null && <div>{deliverable.likes.toLocaleString()} likes</div>}
    </div>
  );
}

function PicSelect({ deliverableId, current, pics }: { deliverableId: string; current: string; pics: Profile[] }) {
  const router = useRouter();
  const [value, setValue] = useState(current);

  async function onChange(next: string) {
    setValue(next);
    await fetch(`/api/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_pic: next || null }),
    });
    router.refresh();
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className="text-xs border border-im8-stone/30 rounded px-2 py-1 text-im8-burgundy focus:outline-none bg-white max-w-[110px] truncate"
    >
      <option value="">Unassigned</option>
      {pics.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
    </select>
  );
}

function EditorSelect({ deliverableId, current, editors }: { deliverableId: string; current: string; editors: Profile[] }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  async function onChange(next: string) {
    setSaving(true);
    setValue(next);
    await fetch(`/api/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_editor_id: next || null }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm border border-im8-stone/30 rounded-lg px-3 py-2 text-im8-burgundy bg-white focus:outline-none focus:ring-1 focus:ring-im8-red disabled:opacity-50"
    >
      <option value="">Unassigned</option>
      {editors.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
    </select>
  );
}

function DeliverablePanel({ deliverable, editors, onClose }: { deliverable: Deliverable; editors: Profile[]; onClose: () => void }) {
  const [comments, setComments] = useState<{ id: string; author_display_name: string; body: string; created_at: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  async function loadComments() {
    const res = await fetch(`/api/deliverables/${deliverable.id}/comments`);
    const { comments: c } = await res.json();
    setComments(c);
    setLoaded(true);
  }

  async function postComment() {
    if (!newComment.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/deliverables/${deliverable.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment }),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setComments(c => [...c, comment]);
      setNewComment("");
    }
    setPosting(false);
  }

  // Load comments on mount
  if (!loaded) loadComments();

  return (
    <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-4 sticky top-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-im8-burgundy">{deliverable.deal?.influencer_name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs bg-im8-sand px-2 py-0.5 rounded text-im8-burgundy">{deliverable.deliverable_type}</span>
            {deliverable.is_story && <span className="text-xs text-im8-burgundy/40">story</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-im8-burgundy/40 hover:text-im8-burgundy text-xl leading-none">×</button>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <DateField label="Due date" deliverableId={deliverable.id} field="due_date" value={deliverable.due_date} />
        <DateField label="Live date" deliverableId={deliverable.id} field="live_date" value={deliverable.live_date} />
      </div>

      {/* Post URL */}
      {deliverable.post_url && (
        <a href={deliverable.post_url} target="_blank" rel="noopener noreferrer"
          className="block text-xs text-im8-red hover:underline break-all">
          {deliverable.post_url} ↗
        </a>
      )}

      {/* Metrics summary */}
      {(deliverable.views !== null || deliverable.likes !== null) && (
        <div className="bg-im8-sand/50 rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Views", val: deliverable.views },
            { label: "Likes", val: deliverable.likes },
            { label: "Comments", val: deliverable.comments_count },
          ].map(m => (
            <div key={m.label}>
              <div className="text-xs text-im8-burgundy/50">{m.label}</div>
              <div className="font-semibold text-im8-burgundy text-sm">{m.val?.toLocaleString() ?? "—"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Brief link */}
      {deliverable.brief && (
        <div className="text-sm">
          <span className="text-im8-burgundy/50 text-xs">Brief: </span>
          <a href={`/admin/briefs/${deliverable.brief.id}`}
            className="text-im8-red hover:underline text-xs">{deliverable.brief.title}</a>
        </div>
      )}

      {/* Assigned editor */}
      <div>
        <label className="block text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide mb-1">
          Assigned editor
        </label>
        <EditorSelect
          deliverableId={deliverable.id}
          current={deliverable.editor?.id ?? ""}
          editors={editors}
        />
        {editors.length === 0 && (
          <p className="text-xs text-im8-burgundy/40 mt-1">
            No editors on the team yet — add one in Settings.
          </p>
        )}
      </div>

      {/* Comments */}
      <div className="space-y-3 border-t border-im8-stone/20 pt-3">
        <div className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">Comments</div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {comments.length === 0 && <p className="text-xs text-im8-burgundy/30">No comments yet.</p>}
          {comments.map(c => (
            <div key={c.id} className="text-xs space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-im8-burgundy">{c.author_display_name}</span>
                <span className="text-im8-burgundy/30">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-im8-burgundy/70 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && postComment()}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-1.5 text-xs border border-im8-stone/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-im8-red/40"
          />
          <button onClick={postComment} disabled={posting || !newComment.trim()}
            className="px-3 py-1.5 bg-im8-red text-white text-xs rounded-lg hover:bg-im8-burgundy disabled:opacity-50">
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

function DateField({ label, deliverableId, field, value }: {
  label: string; deliverableId: string; field: string; value: string | null;
}) {
  const router = useRouter();
  const [val, setVal] = useState(value ?? "");

  async function save(v: string) {
    setVal(v);
    await fetch(`/api/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: v || null }),
    });
    router.refresh();
  }

  return (
    <div>
      <label className="block text-xs text-im8-burgundy/50 mb-1">{label}</label>
      <input type="date" value={val} onChange={e => save(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-im8-stone/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-im8-red/40 text-im8-burgundy" />
    </div>
  );
}
