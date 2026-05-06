"use client";

import { useState, useMemo, useTransition } from "react";
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
  sequence: number | null;
  brief_doc_url?: string | null;
  edited_video_url?: string | null;
  qa_status?: string | null;
  qa_comments?: string | null;
  scheduled_for_ads?: boolean | null;
  ad_usage_rights_status?: string | null;
  whitelisting_granted?: boolean | null;
  whitelisted_start_date?: string | null;
  whitelisted_end_date?: string | null;
  deal: { id: string; influencer_name: string; platform_primary: string; niche_tags?: string[] | null } | null;
  brief: { id: string; title: string } | null;
  pic: { id: string; full_name: string } | null;
  editor: { id: string; full_name: string } | null;
  approved_submission?: { id: string; drive_url: string | null; file_name: string | null } | null;
  pending_submission?: { id: string; drive_url: string | null; file_name: string | null } | null;
};

const QA_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  ready_to_go_live: "bg-emerald-100 text-emerald-700",
  revisions_needed: "bg-orange-100 text-orange-700",
};
const QA_STATUS_LABELS: Record<string, string> = {
  pending: "Pending QA",
  ready_to_go_live: "Ready to go live",
  revisions_needed: "Revisions needed",
};

type Profile = { id: string; full_name: string };

const STATUS_OPTIONS = ["pending", "in_progress", "submitted", "approved", "live", "completed"];
const PLATFORM_OPTIONS = ["instagram", "tiktok", "youtube", "other"];

// Status colours mirror the calendar's KIND_CONFIG palette.
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  in_progress: "bg-orange-100 text-orange-800",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-lime-100 text-lime-800",
  live: "bg-fuchsia-100 text-fuchsia-700",
  completed: "bg-im8-burgundy/10 text-im8-burgundy",
};

type SortKey = "influencer" | "type" | "status" | "due" | null;

export default function DeliverablesTable({
  deliverables,
  pics,
  editors,
  currentFilters,
  availableNiches = [],
  availableTypes = [],
}: {
  deliverables: Deliverable[];
  pics: Profile[];
  editors: Profile[];
  currentFilters: { status?: string; platform?: string; q?: string; month?: string; niche?: string; type?: string };
  availableNiches?: string[];
  availableTypes?: string[];
  canViewRates?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewDraft, setPreviewDraft] = useState<{ url: string; name: string } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function setFilter(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedDeliverables = useMemo(() => {
    if (!sortKey) return deliverables;
    return [...deliverables].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortKey === "influencer") {
        va = (a.deal?.influencer_name ?? "").toLowerCase();
        vb = (b.deal?.influencer_name ?? "").toLowerCase();
      } else if (sortKey === "type") {
        va = `${a.deliverable_type}${String(a.sequence ?? 0).padStart(4, "0")}`;
        vb = `${b.deliverable_type}${String(b.sequence ?? 0).padStart(4, "0")}`;
      } else if (sortKey === "status") {
        va = STATUS_OPTIONS.indexOf(a.status);
        vb = STATUS_OPTIONS.indexOf(b.status);
      } else if (sortKey === "due") {
        va = a.due_date ?? "9999-12-31";
        vb = b.due_date ?? "9999-12-31";
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [deliverables, sortKey, sortDir]);

  const selected = sortedDeliverables.find(d => d.id === selectedId) ?? null;

  const SortIndicator = ({ col }: { col: SortKey }) => (
    <span className={`ml-1 inline-block transition-opacity ${sortKey === col ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
      {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  return (
    <div className="flex gap-6">
      {/* Main table */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-im8-stone/30 p-4">
          <input
            type="text"
            placeholder="Search influencer or title…"
            defaultValue={currentFilters.q ?? ""}
            onBlur={e => setFilter("q", e.target.value)}
            onKeyDown={e => e.key === "Enter" && setFilter("q", (e.target as HTMLInputElement).value)}
            className="px-3 py-1.5 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 w-56"
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
          <select
            value={currentFilters.type ?? ""}
            onChange={e => setFilter("type", e.target.value)}
            className="px-3 py-1.5 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none bg-white"
          >
            <option value="">All content types</option>
            {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {availableNiches.length > 0 && (
            <select
              value={currentFilters.niche ?? ""}
              onChange={e => setFilter("niche", e.target.value)}
              className="px-3 py-1.5 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none bg-white"
            >
              <option value="">All niches</option>
              {availableNiches.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <div className="ml-auto text-xs text-im8-burgundy/50 self-center">{sortedDeliverables.length} rows</div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-white border-b border-im8-stone/20">
                <tr>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap w-10">Done</th>

                  {/* Sortable: Influencer */}
                  <th
                    onClick={() => handleSort("influencer")}
                    className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap cursor-pointer select-none group hover:text-im8-burgundy transition-colors"
                  >
                    Influencer <SortIndicator col="influencer" />
                  </th>

                  {/* Sortable: Type */}
                  <th
                    onClick={() => handleSort("type")}
                    className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap cursor-pointer select-none group hover:text-im8-burgundy transition-colors"
                  >
                    Type <SortIndicator col="type" />
                  </th>

                  {/* Sortable: Status */}
                  <th
                    onClick={() => handleSort("status")}
                    className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap cursor-pointer select-none group hover:text-im8-burgundy transition-colors"
                  >
                    Status <SortIndicator col="status" />
                  </th>

                  {/* Sortable: Due */}
                  <th
                    onClick={() => handleSort("due")}
                    className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap cursor-pointer select-none group hover:text-im8-burgundy transition-colors"
                  >
                    Due <SortIndicator col="due" />
                  </th>

                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap">Content</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap">QA</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap">Post URL</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap">Views</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em] whitespace-nowrap">PIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-im8-stone/10">
                {sortedDeliverables.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-im8-burgundy/40">No deliverables yet. They&rsquo;ll appear here automatically once a deal is approved and deliverables are saved on the contract.</td></tr>
                )}
                {sortedDeliverables.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}
                    className={`cursor-pointer transition-colors hover:bg-im8-offwhite ${selectedId === d.id ? "bg-im8-sand/40" : ""}`}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <DoneToggle deliverableId={d.id} current={d.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-im8-burgundy whitespace-nowrap">
                        {d.deal ? (
                          <Link
                            href={`/admin/deals/${d.deal.id}`}
                            onClick={e => e.stopPropagation()}
                            className="hover:text-im8-red hover:underline"
                          >
                            {d.deal.influencer_name}
                          </Link>
                        ) : "—"}
                      </div>
                      {d.brief && (
                        <Link href={`/admin/briefs/${d.brief.id}`} onClick={e => e.stopPropagation()}
                          className="text-xs text-im8-red/70 hover:underline">
                          {d.brief.title}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs bg-im8-sand/60 px-2 py-0.5 rounded text-im8-burgundy whitespace-nowrap">
                        {d.deliverable_type}{d.sequence ? ` #${d.sequence}` : ""}
                      </span>
                      {d.is_story && <span className="ml-1 text-[10px] text-im8-burgundy/40">story</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect deliverableId={d.id} current={d.status} />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <DueDateCell deliverableId={d.id} current={d.due_date} />
                    </td>

                    {/* Content column: pending → amber "Review" link; approved → green dot */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {d.pending_submission ? (
                        <Link
                          href="/admin/review"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full transition-colors"
                        >
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                          Review →
                        </Link>
                      ) : d.approved_submission?.drive_url ? (
                        <button
                          onClick={() => setPreviewDraft({ url: d.approved_submission!.drive_url!, name: d.approved_submission!.file_name ?? "Approved draft" })}
                          className="text-xs text-im8-red hover:underline inline-flex items-center gap-1 text-left"
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="truncate max-w-[120px]">{d.approved_submission.file_name ?? "Approved draft"}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-im8-burgundy/25">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <QaStatusCell deliverableId={d.id} current={d.qa_status ?? "pending"} />
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
      </div>

      {/* Side panel */}
      {selected && (
        <div className="w-96 shrink-0">
          <DeliverablePanel deliverable={selected} editors={editors} onClose={() => setSelectedId(null)} />
        </div>
      )}
      {previewDraft && (
        <DrivePreviewModal url={previewDraft.url} name={previewDraft.name} onClose={() => setPreviewDraft(null)} />
      )}
    </div>
  );
}

// One-click "Done" toggle.
function DoneToggle({ deliverableId, current }: { deliverableId: string; current: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [saving, setSaving] = useState(false);
  const isDone = status === "approved" || status === "live" || status === "completed";

  async function toggle() {
    if (saving) return;
    setSaving(true);
    const next = isDone ? "pending" : "live";
    setStatus(next);
    await fetch(`/api/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: next,
        live_date: next === "live" ? new Date().toISOString().split("T")[0] : null,
      }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      title={isDone ? "Mark as pending" : "Mark as done"}
      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
        isDone
          ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
          : "bg-white border-im8-stone hover:border-im8-burgundy"
      } ${saving ? "opacity-50" : ""}`}
    >
      {isDone && (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
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

function DueDateCell({ deliverableId, current }: { deliverableId: string; current: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current ?? "");

  async function save(next: string) {
    setEditing(false);
    setVal(next);
    await fetch(`/api/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due_date: next || null }),
    });
    router.refresh();
  }

  if (editing) return (
    <input
      type="date"
      autoFocus
      value={val}
      onChange={e => save(e.target.value)}
      onBlur={() => setEditing(false)}
      className="px-2 py-1 text-xs border border-im8-stone/40 rounded focus:outline-none focus:ring-2 focus:ring-im8-red/30"
    />
  );

  return (
    <button onClick={() => setEditing(true)}
      className="text-xs text-im8-burgundy/70 hover:text-im8-red hover:underline">
      {current ? new Date(current).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "2-digit" }) : <span className="text-im8-burgundy/30">+ Set</span>}
    </button>
  );
}

function QaStatusCell({ deliverableId, current }: { deliverableId: string; current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);

  async function onChange(next: string) {
    setValue(next);
    await fetch(`/api/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qa_status: next }),
    });
    router.refresh();
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${QA_STATUS_COLORS[value] ?? "bg-gray-100 text-gray-600"}`}
    >
      {Object.entries(QA_STATUS_LABELS).map(([v, label]) => (
        <option key={v} value={v} className="bg-white text-im8-burgundy">{label}</option>
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
      className="text-xs text-im8-burgundy/30 hover:text-im8-red">
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
    return <span className="text-xs text-im8-burgundy/25">—</span>;
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
      {deliverable.views !== null ? deliverable.views.toLocaleString() : <span className="text-im8-burgundy/30">+ Views</span>}
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

  if (!loaded) loadComments();

  return (
    <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-4 sticky top-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-im8-burgundy">{deliverable.deal?.influencer_name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs bg-im8-sand px-2 py-0.5 rounded text-im8-burgundy">{deliverable.deliverable_type}{deliverable.sequence ? ` #${deliverable.sequence}` : ""}</span>
            {deliverable.is_story && <span className="text-xs text-im8-burgundy/40">story</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[deliverable.status] ?? "bg-gray-100 text-gray-600"}`}>
              {deliverable.status.replace("_", " ")}
            </span>
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

      {/* Review queue link if pending */}
      {deliverable.pending_submission && (
        <Link
          href="/admin/review"
          className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          Submission pending review — open review queue →
        </Link>
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

      {/* QA */}
      <div className="space-y-3 border-t border-im8-stone/20 pt-3">
        <div className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">QA</div>

        <div>
          <label className="block text-xs text-im8-burgundy/60 mb-1">QA status</label>
          <QaStatusCell deliverableId={deliverable.id} current={deliverable.qa_status ?? "pending"} />
        </div>

        <div>
          <label className="block text-xs text-im8-burgundy/60 mb-1">QA comments</label>
          <QaCommentsField deliverableId={deliverable.id} current={deliverable.qa_comments ?? ""} />
        </div>
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

function DrivePreviewModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const fileId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  const embedUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-im8-stone/20">
          <span className="text-sm font-medium text-im8-burgundy truncate max-w-[500px]">{name}</span>
          <div className="flex items-center gap-3 shrink-0">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-im8-red hover:underline">Open in Drive ↗</a>
            <button onClick={onClose} className="text-im8-burgundy/40 hover:text-im8-burgundy text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-gray-50">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full min-h-[500px]"
              allow="autoplay"
              title={name}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-im8-burgundy/40 text-sm">
              Preview unavailable —{" "}
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-im8-red hover:underline ml-1">open in Drive ↗</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QaCommentsField({ deliverableId, current }: { deliverableId: string; current: string }) {
  const router = useRouter();
  const [val, setVal] = useState(current);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function save(next: string) {
    if (next === current) return;
    setStatus("saving");
    await fetch(`/api/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qa_comments: next || null }),
    });
    setStatus("saved");
    router.refresh();
    setTimeout(() => setStatus("idle"), 1500);
  }

  return (
    <div>
      <textarea
        rows={3}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => save(val.trim())}
        placeholder="Notes from QA…"
        className="w-full px-2 py-1.5 text-xs border border-im8-stone/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-im8-red/40 text-im8-burgundy resize-none"
      />
      <span className="text-xs text-im8-burgundy/40">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : ""}
      </span>
    </div>
  );
}
