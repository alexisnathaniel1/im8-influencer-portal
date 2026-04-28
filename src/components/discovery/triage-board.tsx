"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type DiscoveryProfile = {
  id: string;
  status: string;
  source: string;
  influencer_name: string;
  submitter_name: string | null;
  submitter_email: string | null;
  agency_name: string | null;
  platform_primary: string;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
  follower_count: number | null;
  proposed_rate_cents: number | null;
  niche_tags: string[] | null;
  niche: string[] | null;
  others_niche: string | null;
  positioning: string | null;
  proposed_deliverables: Array<{ code: string; count: number }> | null;
  ai_score: number | null;
  ai_summary: string | null;
  ai_red_flags: string[];
  comments_count?: number;
  created_at: string;
  negotiation_counter: string | null;
  agency_response: string | null;
  total_months: number | null;
};

// Filter tabs ordered to reflect the pipeline stages.
const STATUSES = ["new", "negotiation_needed", "approved", "converted", "rejected"];
const STATUS_LABELS: Record<string, string> = {
  new: "Submitted",
  submitted: "Submitted",
  reviewing: "Under Review",          // legacy
  negotiation_needed: "Negotiation Needed",
  approved: "Approved",               // transient — shown on rows but not a tab
  shortlisted: "Approved",            // legacy alias
  rejected: "Rejected",
  converted: "Pending MGMT Approval",
};
// Each status gets its own colour so reviewers can scan the table at a glance.
// Off-brand semantic palette is fine here — the user explicitly carved out
// status pills as the one place these colours are allowed.
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",                  // just submitted
  submitted: "bg-blue-100 text-blue-700",            // just submitted
  reviewing: "bg-yellow-100 text-yellow-700",        // under review
  negotiation_needed: "bg-amber-100 text-amber-700", // action required
  approved: "bg-green-100 text-green-700",           // good to go
  shortlisted: "bg-green-100 text-green-700",        // good to go (alias)
  rejected: "bg-red-100 text-red-700",               // declined
  converted: "bg-im8-burgundy/15 text-im8-burgundy", // already pending MGMT
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-xs text-im8-burgundy/30">—</span>;
  const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
  return <span className={`text-sm font-bold ${color}`}>{score}/100</span>;
}

const STANDARD_USAGE_RIGHTS = ["Whitelisting", "Paid ad usage rights", "Link in bio"];

// Mirrors the canonical catalogue used in the Partner Tracker
// (src/components/deals/deal-detail-client.tsx) so counter-proposals,
// approved deals, and partner-facing summaries all reference the same codes.
const DELIVERABLE_LABELS: Record<string, string> = {
  // Instagram
  IGR: "Instagram Reels",
  IGS: "Instagram Stories",
  // TikTok
  TIKTOK: "TikTok Videos",
  // YouTube — broken down by format
  YT_DEDICATED: "YouTube Dedicated Review",
  YT_INTEGRATED: "YouTube Integrated Review",
  YT_PODCAST: "YouTube Podcast Ad Read",
  // UGC + other formats
  UGC: "UGC Videos",
  NEWSLETTER: "Newsletter",
  APP_PARTNERSHIP: "App Partnership",
  BLOG: "Blog Post",
  // Rights / extras — Yes/No grants, no count needed
  WHITELIST: "Whitelisting",
  PAID_AD: "Paid Ad Usage Rights",
  RAW_FOOTAGE: "Raw Footage",
  LINK_BIO: "Link in Bio",
};
const BINARY_DELIVERABLE_CODES = new Set(["WHITELIST", "PAID_AD", "RAW_FOOTAGE", "LINK_BIO"]);
// Order shown in the dropdown — content deliverables first, rights/extras last.
const COUNTER_DELIVERABLE_CODES = [
  "IGR", "IGS", "TIKTOK",
  "YT_DEDICATED", "YT_INTEGRATED", "YT_PODCAST",
  "UGC", "NEWSLETTER", "APP_PARTNERSHIP", "BLOG",
  "WHITELIST", "PAID_AD", "RAW_FOOTAGE", "LINK_BIO",
];

type Comment = {
  id: string;
  author_display_name: string;
  body: string;
  visible_to_partner: boolean;
  kind: string;
  created_at: string;
};

// mode for the unified activity composer
type NoteMode = "internal" | "visible" | "email";

export default function DiscoveryBoard({
  profiles,
  statusCounts,
  currentFilters,
}: {
  profiles: DiscoveryProfile[];
  statusCounts: { status: string; count: number }[];
  currentFilters: { status?: string; platform?: string; q?: string };
}) {
  const router = useRouter();
  const [search, setSearch] = useState(currentFilters.q ?? "");
  const [updating, setUpdating] = useState<string | null>(null);
  const [openProfile, setOpenProfile] = useState<DiscoveryProfile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteMode, setNoteMode] = useState<NoteMode>("internal");
  const [noteEmail, setNoteEmail] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Counter-proposal fields
  const [counterRate, setCounterRate] = useState("");
  const [counterMonths, setCounterMonths] = useState("3");
  const [counterDeliverables, setCounterDeliverables] = useState<Array<{ code: string; count: number }>>([]);
  const [counterNotes, setCounterNotes] = useState("");
  const [counterEmail, setCounterEmail] = useState("");
  const [sendingCounter, setSendingCounter] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Column sort state — click a header to toggle ascending / descending.
  type SortKey = "name" | "status" | "niche" | "followers" | "rate";
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Status sort uses a workflow ordering so "ascending" reads as pipeline
  // progression (new → reviewing → negotiation → approved → converted) rather
  // than alphabetical, which is more useful for triage.
  const STATUS_RANK: Record<string, number> = {
    new: 0, submitted: 0,
    reviewing: 1,
    negotiation_needed: 2,
    approved: 3, shortlisted: 3,
    converted: 4,
    rejected: 5,
  };

  const sortedProfiles = [...profiles].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const aNiches = (a.niche_tags ?? a.niche ?? []).join(", ");
    const bNiches = (b.niche_tags ?? b.niche ?? []).join(", ");
    let cmp = 0;
    switch (sortKey) {
      case "name": cmp = (a.influencer_name ?? "").localeCompare(b.influencer_name ?? ""); break;
      case "status": cmp = (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99); break;
      case "niche": cmp = aNiches.localeCompare(bNiches); break;
      case "followers": cmp = (a.follower_count ?? 0) - (b.follower_count ?? 0); break;
      case "rate": cmp = (a.proposed_rate_cents ?? 0) - (b.proposed_rate_cents ?? 0); break;
    }
    return cmp * dir;
  });

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(currentFilters as Record<string, string>);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/discovery?${params.toString()}`);
  }

  async function loadComments(profileId: string) {
    setCommentsLoading(true);
    const res = await fetch(`/api/discovery/${profileId}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments ?? []);
    }
    setCommentsLoading(false);
  }

  async function openRow(profile: DiscoveryProfile) {
    setOpenProfile(profile);
    setNoteEmail(profile.submitter_email ?? "");
    setNoteBody("");
    setNoteMode("internal");
    // Initialise counter-proposal from existing profile values
    setCounterRate(profile.proposed_rate_cents ? String(profile.proposed_rate_cents / 100) : "");
    setCounterMonths(profile.total_months ? String(profile.total_months) : "3");
    setCounterDeliverables(
      (profile.proposed_deliverables ?? []).filter(d => d.code !== "WHITELIST")
    );
    setCounterNotes(profile.negotiation_counter ?? "");
    setCounterEmail(profile.submitter_email ?? "");
    await loadComments(profile.id);
  }

  function closeRow() {
    setOpenProfile(null);
    setComments([]);
    setNoteBody("");
  }

  async function updateStatus(profileId: string, newStatus: string) {
    setUpdating(profileId);
    const res = await fetch(`/api/discovery/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) alert("Failed to update status");
    // Refresh activity feed if panel is open
    if (openProfile?.id === profileId) {
      setOpenProfile(p => p ? { ...p, status: newStatus } : p);
      await loadComments(profileId);
    }
    router.refresh();
    setUpdating(null);
  }

  async function submitNote() {
    if (!openProfile || !noteBody.trim()) return;
    setNoteSubmitting(true);

    if (noteMode === "email") {
      if (!noteEmail.trim()) { setNoteSubmitting(false); return; }
      const res = await fetch(`/api/discovery/${openProfile.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: noteEmail, message: noteBody }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comment) setComments(prev => [...prev, data.comment]);
        setNoteBody("");
      } else {
        alert("Failed to send email");
      }
    } else {
      const res = await fetch(`/api/discovery/${openProfile.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody, visible_to_partner: noteMode === "visible" }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [...prev, data.comment]);
        setNoteBody("");
      } else {
        alert("Failed to post note");
      }
    }

    setNoteSubmitting(false);
  }

  async function sendCounterProposal() {
    if (!openProfile || !counterEmail.trim()) return;
    setSendingCounter(true);
    const parsedMonths = parseInt(counterMonths);
    const months = Number.isFinite(parsedMonths) && parsedMonths > 0 ? parsedMonths : 3;
    const res = await fetch(`/api/discovery/${openProfile.id}/counter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: counterEmail,
        rate_usd: counterRate ? parseFloat(counterRate) : null,
        deliverables: counterDeliverables,
        notes: counterNotes || null,
        total_months: months,
      }),
    });
    setSendingCounter(false);
    if (res.ok) {
      const data = await res.json();
      if (data.comment) setComments(prev => [...prev, data.comment]);
      router.refresh();
    } else {
      alert("Failed to send counter-proposal. Please try again.");
    }
  }

  async function deleteProfile(profileId: string, name: string) {
    if (!confirm(`Delete "${name}" from Discovery? This cannot be undone.`)) return;
    setDeletingId(profileId);
    const res = await fetch(`/api/discovery/${profileId}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete profile.");
    } else {
      if (openProfile?.id === profileId) closeRow();
      router.refresh();
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => applyFilter("status", "")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !currentFilters.status ? "bg-im8-burgundy text-white" : "bg-white border border-im8-stone text-im8-burgundy hover:bg-im8-sand"
          }`}>
          All ({statusCounts.reduce((a, b) => a + b.count, 0)})
        </button>
        {STATUSES.map(status => {
          const count = statusCounts.find(s => s.status === status)?.count ?? 0;
          return (
            <button key={status} onClick={() => applyFilter("status", status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentFilters.status === status
                  ? "bg-im8-burgundy text-white"
                  : "bg-white border border-im8-stone text-im8-burgundy hover:bg-im8-sand"
              }`}>
              {STATUS_LABELS[status] ?? status} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <input
          type="text" value={search} placeholder="Search by creator name..."
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && applyFilter("q", search)}
          className="flex-1 px-4 py-2 rounded-lg border border-im8-stone/40 text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
        />
        <select value={currentFilters.platform ?? ""} onChange={e => applyFilter("platform", e.target.value)}
          className="px-3 py-2 rounded-lg border border-im8-stone/40 text-sm text-im8-burgundy focus:outline-none">
          <option value="">All platforms</option>
          {["instagram", "tiktok", "youtube", "other"].map(p => (
            <option key={p} value={p} className="capitalize">{p}</option>
          ))}
        </select>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No profiles yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
          <table className="w-full text-sm table-auto">
            <thead className="bg-white border-b border-im8-stone/20">
              <tr className="text-left text-im8-muted text-[11px] uppercase tracking-[0.07em] font-semibold">
                {([
                  { key: "name", label: "Creator" },
                  { key: "status", label: "Status" },
                  { key: "niche", label: "Niche" },
                  { key: "followers", label: "Followers" },
                  { key: "rate", label: "Rate" },
                ] as const).map(col => (
                  <th key={col.key} className="px-4 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-im8-burgundy transition-colors"
                    >
                      <span>{col.label}</span>
                      <span className={`text-[9px] ${sortKey === col.key ? "text-im8-burgundy" : "text-im8-muted/40"}`}>
                        {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedProfiles.map(p => {
                const niches = p.niche_tags ?? p.niche ?? [];
                return (
                  <tr key={p.id} className="border-b border-im8-stone/20 hover:bg-im8-offwhite cursor-pointer transition-colors"
                      onClick={() => openRow(p)}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-im8-burgundy truncate max-w-[200px]">{p.influencer_name}</div>
                      <div className="text-xs text-im8-burgundy/50 capitalize mt-0.5">{p.platform_primary}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-[6px] font-medium whitespace-nowrap ${STATUS_COLORS[p.status] ?? ""}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-im8-burgundy/70 whitespace-nowrap">
                      <span className="truncate inline-block max-w-[160px] align-bottom">
                        {niches.slice(0, 2).join(", ") || "—"}
                      </span>
                      {niches.length > 2 && <span className="text-im8-burgundy/40"> +{niches.length - 2}</span>}
                    </td>
                    <td className="px-4 py-3 text-im8-burgundy/70 whitespace-nowrap">
                      {p.follower_count ? `${(p.follower_count / 1000).toFixed(0)}K` : "—"}
                    </td>
                    <td className="px-4 py-3 text-im8-burgundy/70 whitespace-nowrap">
                      {p.proposed_rate_cents ? `$${(p.proposed_rate_cents / 100).toFixed(0)}/mo` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="inline-flex gap-1 items-center">
                        {p.status !== "approved" && p.status !== "converted" && p.status !== "rejected" && (
                          <button onClick={() => updateStatus(p.id, "approved")} disabled={updating === p.id}
                            className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50">
                            → MGMT
                          </button>
                        )}
                        {p.status !== "rejected" && p.status !== "converted" && (
                          <button onClick={() => updateStatus(p.id, "rejected")} disabled={updating === p.id}
                            className="text-xs px-2.5 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors disabled:opacity-50">
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => deleteProfile(p.id, p.influencer_name)}
                          disabled={deletingId === p.id}
                          title="Delete profile"
                          className="text-xs px-2 py-1 text-im8-burgundy/30 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Side panel */}
      {openProfile && (
        <div className="fixed inset-0 z-40 flex">
          <button onClick={closeRow} className="flex-1 bg-black/30" aria-label="Close" />
          <div className="w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-im8-stone/30 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-im8-burgundy">{openProfile.influencer_name}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-im8-burgundy/60">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[openProfile.status] ?? ""}`}>
                    {STATUS_LABELS[openProfile.status] ?? openProfile.status}
                  </span>
                  <span className="capitalize">{openProfile.platform_primary}</span>
                  {openProfile.agency_name && <span>· {openProfile.agency_name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteProfile(openProfile.id, openProfile.influencer_name)}
                  disabled={deletingId === openProfile.id}
                  title="Delete this profile"
                  className="text-sm text-im8-burgundy/30 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  🗑 Delete
                </button>
                <button onClick={closeRow} className="text-im8-burgundy/40 hover:text-im8-burgundy text-2xl leading-none">×</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status transitions */}
              <div className="space-y-2">
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide">Set status</div>
                <div className="flex flex-wrap gap-2">
                  {/* Approve → triggers deal + packet creation + auto-converts to Pending MGMT Approval */}
                  {openProfile.status !== "converted" && openProfile.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(openProfile.id, "approved")}
                      disabled={updating === openProfile.id}
                      className="text-xs px-3 py-1.5 rounded-full font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                      ✓ Approve → Send to MGMT
                    </button>
                  )}
                  {/* Negotiation Needed */}
                  <button
                    onClick={() => updateStatus(openProfile.id, "negotiation_needed")}
                    disabled={updating === openProfile.id || openProfile.status === "negotiation_needed"}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      openProfile.status === "negotiation_needed" ? "bg-im8-burgundy text-white" : "bg-im8-sand text-im8-burgundy hover:bg-im8-stone"
                    } disabled:opacity-50`}>
                    Negotiation Needed
                  </button>
                  {/* Rejected */}
                  <button
                    onClick={() => updateStatus(openProfile.id, "rejected")}
                    disabled={updating === openProfile.id || openProfile.status === "rejected"}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      openProfile.status === "rejected" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
                    } disabled:opacity-50`}>
                    Rejected
                  </button>
                  {/* Revert to Submitted */}
                  {(openProfile.status === "negotiation_needed" || openProfile.status === "rejected") && (
                    <button
                      onClick={() => updateStatus(openProfile.id, "new")}
                      disabled={updating === openProfile.id}
                      className="text-xs px-3 py-1.5 rounded-full font-medium bg-im8-sand text-im8-burgundy hover:bg-im8-stone disabled:opacity-50 transition-colors">
                      ← Back to Submitted
                    </button>
                  )}
                </div>
                {openProfile.status === "converted" && (
                  <p className="text-xs text-purple-700 bg-purple-50 rounded-lg px-3 py-2">
                    This profile has been sent to the MGMT Approvals queue.
                  </p>
                )}
              </div>

              {/* Profile details */}
              <div>
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">Profile</div>
                <div className="space-y-1 text-sm">
                  {openProfile.instagram_handle && <div><span className="text-im8-burgundy/50">IG:</span> <a href={`https://instagram.com/${openProfile.instagram_handle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-im8-red hover:underline">@{openProfile.instagram_handle}</a></div>}
                  {openProfile.tiktok_handle && <div><span className="text-im8-burgundy/50">TT:</span> <a href={`https://tiktok.com/@${openProfile.tiktok_handle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-im8-red hover:underline">@{openProfile.tiktok_handle}</a></div>}
                  {openProfile.youtube_handle && <div><span className="text-im8-burgundy/50">YT:</span> <a href={`https://youtube.com/@${openProfile.youtube_handle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-im8-red hover:underline">@{openProfile.youtube_handle}</a></div>}
                  <div><span className="text-im8-burgundy/50">Submitted:</span> {new Date(openProfile.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</div>
                  {openProfile.follower_count !== null && <div><span className="text-im8-burgundy/50">Followers:</span> {openProfile.follower_count?.toLocaleString()}</div>}
                  {openProfile.proposed_rate_cents !== null && <div><span className="text-im8-burgundy/50">Proposed rate:</span> ${((openProfile.proposed_rate_cents ?? 0) / 100).toFixed(0)}/mo</div>}
                </div>
              </div>

              {openProfile.positioning && (
                <div>
                  <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">Positioning</div>
                  <p className="text-sm text-im8-burgundy/80 italic">&ldquo;{openProfile.positioning}&rdquo;</p>
                </div>
              )}

              {(openProfile.niche_tags ?? openProfile.niche ?? []).length > 0 && (
                <div>
                  <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">Niches</div>
                  <div className="flex flex-wrap gap-1">
                    {(openProfile.niche_tags ?? openProfile.niche ?? []).map(n => (
                      <span key={n} className="text-xs bg-im8-sand text-im8-burgundy px-2 py-0.5 rounded-full">{n}</span>
                    ))}
                    {openProfile.others_niche && (
                      <span className="text-xs bg-im8-sand text-im8-burgundy/60 px-2 py-0.5 rounded-full italic">{openProfile.others_niche}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Deliverables + Usage rights */}
              {openProfile.proposed_deliverables && openProfile.proposed_deliverables.length > 0 && (
                <div>
                  <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">Proposed deliverables</div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {openProfile.proposed_deliverables
                      .filter(d => d.code !== "WHITELIST")
                      .map(d => (
                        <span key={d.code} className="text-xs bg-im8-red/10 text-im8-burgundy px-2 py-0.5 rounded-full">
                          {d.count} × {DELIVERABLE_LABELS[d.code] ?? d.code}
                        </span>
                      ))}
                  </div>
                  <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-1">Usage rights (standard)</div>
                  <div className="flex flex-wrap gap-1">
                    {STANDARD_USAGE_RIGHTS.map(r => (
                      <span key={r} className="text-xs bg-im8-sand text-im8-burgundy/70 px-2 py-0.5 rounded-full">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              {openProfile.ai_summary && (
                <div>
                  <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">AI review</div>
                  <p className="text-sm text-im8-burgundy/70">{openProfile.ai_summary}</p>
                  {openProfile.ai_red_flags?.length > 0 && (
                    <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
                      {openProfile.ai_red_flags.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Counter-proposal (negotiation_needed only) */}
              {openProfile.status === "negotiation_needed" && (
                <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">
                      Counter-proposal to {openProfile.agency_name ? "agency" : "creator"}
                    </p>
                    {openProfile.agency_response && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${openProfile.agency_response === "accepted" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {openProfile.agency_response === "accepted" ? "✓ Accepted" : "✗ Declined"}
                      </span>
                    )}
                  </div>

                  {/* Rate + Duration */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-orange-700 mb-1">Monthly rate (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-im8-burgundy/50">$</span>
                        <input
                          type="number" min="0" value={counterRate}
                          onChange={e => setCounterRate(e.target.value)}
                          placeholder="e.g. 3000"
                          className="w-full pl-7 pr-3 py-2 border border-orange-300 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-orange-700 mb-1">Duration</label>
                      <div className="relative">
                        <input
                          type="number" min="1" max="24" value={counterMonths}
                          onChange={e => setCounterMonths(e.target.value)}
                          placeholder="3"
                          className="w-full pl-3 pr-12 py-2 border border-orange-300 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-im8-burgundy/50 pointer-events-none">months</span>
                      </div>
                    </div>
                  </div>
                  {counterRate && (
                    <p className="text-xs text-orange-600 -mt-2">
                      ${(parseFloat(counterRate) * (parseInt(counterMonths) || 3)).toLocaleString()} total over {parseInt(counterMonths) || 3} month{(parseInt(counterMonths) || 3) === 1 ? "" : "s"}
                    </p>
                  )}

                  {/* Deliverables */}
                  <div>
                    <label className="block text-xs font-semibold text-orange-700 mb-2">Deliverables</label>
                    <div className="space-y-2">
                      {counterDeliverables.map((d, idx) => {
                        const isBinary = BINARY_DELIVERABLE_CODES.has(d.code);
                        return (
                          <div key={`${d.code}-${idx}`} className="flex items-center gap-2">
                            <select
                              value={d.code}
                              onChange={e => {
                                const nextCode = e.target.value;
                                const nextIsBinary = BINARY_DELIVERABLE_CODES.has(nextCode);
                                setCounterDeliverables(prev => prev.map((x, i) =>
                                  i === idx ? { code: nextCode, count: nextIsBinary ? 1 : (BINARY_DELIVERABLE_CODES.has(x.code) ? 1 : x.count) } : x
                                ));
                              }}
                              className="flex-1 px-2 py-1.5 border border-orange-300 rounded-lg text-sm text-im8-burgundy focus:outline-none bg-white"
                            >
                              {COUNTER_DELIVERABLE_CODES.map(c => (
                                <option key={c} value={c}>{DELIVERABLE_LABELS[c] ?? c}</option>
                              ))}
                            </select>
                            {isBinary ? (
                              <span className="w-16 px-2 py-1.5 text-xs text-im8-burgundy/60 text-center">Yes</span>
                            ) : (
                              <input
                                type="number" min="1" max="20" value={d.count}
                                onChange={e => setCounterDeliverables(prev => prev.map((x, i) => i === idx ? { ...x, count: parseInt(e.target.value) || 1 } : x))}
                                className="w-16 px-2 py-1.5 border border-orange-300 rounded-lg text-sm text-im8-burgundy text-center focus:outline-none"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => setCounterDeliverables(prev => prev.filter((_, i) => i !== idx))}
                              className="text-orange-400 hover:text-red-500 text-lg leading-none px-1"
                            >×</button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setCounterDeliverables(prev => [...prev, { code: "IGR", count: 1 }])}
                        className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                      >+ Add deliverable</button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-orange-700 mb-1">Additional notes <span className="font-normal text-orange-500">(optional)</span></label>
                    <textarea
                      value={counterNotes}
                      onChange={e => setCounterNotes(e.target.value)}
                      placeholder="Any additional context, conditions, or terms to include in the email…"
                      rows={3}
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-orange-400/40 resize-none"
                    />
                  </div>

                  {/* Recipient */}
                  <div>
                    <label className="block text-xs font-semibold text-orange-700 mb-1">Send to</label>
                    <input
                      type="email" value={counterEmail}
                      onChange={e => setCounterEmail(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                    />
                  </div>

                  <button
                    onClick={sendCounterProposal}
                    disabled={sendingCounter || !counterEmail.trim()}
                    className="w-full py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {sendingCounter ? "Sending…" : "Send counter-proposal email"}
                  </button>
                </div>
              )}

              {/* Unified activity feed */}
              <div className="border-t border-im8-stone/30 pt-5 space-y-4">
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide">Activity</div>

                {/* Feed */}
                {commentsLoading ? (
                  <p className="text-xs text-im8-burgundy/40">Loading…</p>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-im8-burgundy/40 italic">No activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map(c => {
                      const isSystem = c.kind === "status_change";
                      const isEmail = c.kind === "notify";
                      return (
                        <div key={c.id} className={`rounded-lg p-3 text-sm ${
                          isSystem ? "bg-gray-50 border border-gray-200" :
                          isEmail  ? "bg-blue-50 border border-blue-200" :
                          c.visible_to_partner ? "bg-green-50 border border-green-200" :
                          "bg-im8-sand/40 border border-im8-stone/20"
                        }`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-im8-burgundy">
                                {c.author_display_name || "System"}
                              </span>
                              {isSystem && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-medium">Status change</span>}
                              {isEmail  && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200 text-blue-700 font-medium">Email sent</span>}
                              {!isSystem && !isEmail && c.visible_to_partner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-200 text-green-700 font-medium">Visible to submitter</span>}
                              {!isSystem && !isEmail && !c.visible_to_partner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">Internal</span>}
                            </div>
                            <span className="text-[10px] text-im8-burgundy/40 shrink-0 whitespace-nowrap">
                              {new Date(c.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-im8-burgundy/80 whitespace-pre-wrap">{c.body}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Composer */}
                <div className="space-y-2">
                  {/* Mode selector */}
                  <div className="flex rounded-lg overflow-hidden border border-im8-stone/40 text-xs font-medium">
                    {(["internal", "visible", "email"] as NoteMode[]).map((m) => {
                      const labels = { internal: "Internal note", visible: "Share with submitter", email: "Email submitter" };
                      return (
                        <button key={m} type="button"
                          onClick={() => setNoteMode(m)}
                          className={`flex-1 py-1.5 transition-colors ${noteMode === m ? "bg-im8-burgundy text-white" : "bg-white text-im8-burgundy/60 hover:bg-im8-sand"}`}>
                          {labels[m]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Email recipient (shown only in email mode) */}
                  {noteMode === "email" && (
                    <input type="email" value={noteEmail} onChange={e => setNoteEmail(e.target.value)}
                      placeholder="Recipient email"
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                  )}

                  <textarea value={noteBody} onChange={e => setNoteBody(e.target.value)}
                    placeholder={
                      noteMode === "internal" ? "Add an internal note (only visible to the team)…" :
                      noteMode === "visible"  ? "Write a note — the submitter will see this on their dashboard…" :
                      "Write your message — this will be sent by email and logged here…"
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
                  />
                  <button
                    onClick={submitNote}
                    disabled={noteSubmitting || !noteBody.trim() || (noteMode === "email" && !noteEmail.trim())}
                    className="w-full py-2 bg-im8-burgundy text-white text-sm font-medium rounded-lg hover:bg-im8-red disabled:opacity-50 transition-colors">
                    {noteSubmitting ? "Posting…" : noteMode === "email" ? "Send email & log" : "Post note"}
                  </button>
                </div>
              </div>

              <Link href={`/admin/discovery/${openProfile.id}`}
                className="block text-center py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy hover:bg-im8-sand transition-colors">
                Open full detail →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
