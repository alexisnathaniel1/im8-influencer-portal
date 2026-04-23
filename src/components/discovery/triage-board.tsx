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
};

const STATUSES = ["new", "reviewing", "negotiation_needed", "approved", "rejected", "converted"];
const STATUS_LABELS: Record<string, string> = {
  new: "Submitted",
  reviewing: "Reviewed",
  negotiation_needed: "Negotiation needed",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  shortlisted: "Shortlisted",
  submitted: "Submitted",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  submitted: "bg-blue-100 text-blue-700",
  reviewing: "bg-yellow-100 text-yellow-700",
  negotiation_needed: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  shortlisted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-xs text-im8-burgundy/30">—</span>;
  const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
  return <span className={`text-sm font-bold ${color}`}>{score}/100</span>;
}

type Comment = {
  id: string;
  author_display_name: string;
  body: string;
  visible_to_partner: boolean;
  kind: string;
  created_at: string;
};

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
  const [commentBody, setCommentBody] = useState("");
  const [commentVisibleToPartner, setCommentVisibleToPartner] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifying, setNotifying] = useState(false);

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(currentFilters as Record<string, string>);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/discovery?${params.toString()}`);
  }

  async function updateStatus(profileId: string, newStatus: string) {
    setUpdating(profileId);
    const res = await fetch(`/api/discovery/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      alert("Failed to update status");
    }
    router.refresh();
    setUpdating(null);
  }

  async function openRow(profile: DiscoveryProfile) {
    setOpenProfile(profile);
    setNotifyEmail(profile.submitter_email ?? "");
    setNotifyMessage("");
    setCommentsLoading(true);
    const res = await fetch(`/api/discovery/${profile.id}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments ?? []);
    }
    setCommentsLoading(false);
  }

  function closeRow() {
    setOpenProfile(null);
    setComments([]);
    setCommentBody("");
  }

  async function postComment() {
    if (!openProfile || !commentBody.trim()) return;
    const res = await fetch(`/api/discovery/${openProfile.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody, visible_to_partner: commentVisibleToPartner }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments(prev => [...prev, data.comment]);
      setCommentBody("");
    } else {
      alert("Failed to post comment");
    }
  }

  async function sendNotify() {
    if (!openProfile || !notifyEmail.trim()) return;
    setNotifying(true);
    const res = await fetch(`/api/discovery/${openProfile.id}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: notifyEmail, message: notifyMessage }),
    });
    setNotifying(false);
    if (res.ok) {
      setNotifyMessage("");
      const data = await res.json();
      if (data.comment) setComments(prev => [...prev, data.comment]);
    } else {
      alert("Failed to send notification");
    }
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
          {["instagram", "tiktok", "youtube", "facebook", "other"].map(p => (
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
          <table className="w-full text-sm">
            <thead className="bg-im8-sand/60 border-b border-im8-stone/30">
              <tr className="text-left text-im8-burgundy/60 text-xs uppercase tracking-wide">
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Niche</th>
                <th className="px-4 py-3">Followers</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">AI</th>
                <th className="px-4 py-3">Comments</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => {
                const niches = p.niche_tags ?? p.niche ?? [];
                return (
                  <tr key={p.id} className="border-b border-im8-stone/20 hover:bg-im8-sand/30 cursor-pointer"
                      onClick={() => openRow(p)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-im8-burgundy">{p.influencer_name}</div>
                      <div className="text-xs text-im8-burgundy/50 capitalize">{p.platform_primary}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? ""}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-im8-burgundy/70">
                      {niches.slice(0, 2).join(", ") || "—"}
                      {niches.length > 2 && <span className="text-im8-burgundy/40"> +{niches.length - 2}</span>}
                    </td>
                    <td className="px-4 py-3 text-im8-burgundy/70">
                      {p.follower_count ? `${(p.follower_count / 1000).toFixed(0)}K` : "—"}
                    </td>
                    <td className="px-4 py-3 text-im8-burgundy/70">
                      {p.proposed_rate_cents ? `$${(p.proposed_rate_cents / 100).toFixed(0)}/mo` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={p.ai_score} />
                    </td>
                    <td className="px-4 py-3 text-im8-burgundy/70 text-xs">
                      {p.comments_count ? `${p.comments_count} 💬` : <span className="text-im8-burgundy/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="inline-flex gap-1">
                        {p.status !== "approved" && p.status !== "converted" && p.status !== "rejected" && (
                          <button onClick={() => updateStatus(p.id, "approved")} disabled={updating === p.id}
                            className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50">
                            Approve
                          </button>
                        )}
                        {p.status !== "rejected" && (
                          <button onClick={() => updateStatus(p.id, "rejected")} disabled={updating === p.id}
                            className="text-xs px-2.5 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors disabled:opacity-50">
                            Reject
                          </button>
                        )}
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
              <button onClick={closeRow} className="text-im8-burgundy/40 hover:text-im8-burgundy text-2xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status transitions */}
              <div>
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">Status</div>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => { updateStatus(openProfile.id, s); setOpenProfile(p => p ? { ...p, status: s } : p); }}
                      disabled={updating === openProfile.id || openProfile.status === s}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                        openProfile.status === s ? "bg-im8-burgundy text-white" : "bg-im8-sand text-im8-burgundy hover:bg-im8-stone"
                      } disabled:opacity-50`}>
                      {STATUS_LABELS[s] ?? s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile details */}
              <div>
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">Profile</div>
                <div className="space-y-1 text-sm">
                  {openProfile.instagram_handle && <div><span className="text-im8-burgundy/50">IG:</span> @{openProfile.instagram_handle}</div>}
                  {openProfile.tiktok_handle && <div><span className="text-im8-burgundy/50">TT:</span> @{openProfile.tiktok_handle}</div>}
                  {openProfile.youtube_handle && <div><span className="text-im8-burgundy/50">YT:</span> @{openProfile.youtube_handle}</div>}
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

              {openProfile.proposed_deliverables && openProfile.proposed_deliverables.length > 0 && (
                <div>
                  <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">Proposed deliverables</div>
                  <div className="flex flex-wrap gap-1">
                    {openProfile.proposed_deliverables.map(d => (
                      <span key={d.code} className="text-xs bg-im8-red/10 text-im8-burgundy px-2 py-0.5 rounded-full">
                        {d.count} × {d.code}
                      </span>
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

              {/* Notify */}
              <div className="border-t border-im8-stone/30 pt-5">
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">Notify submitter</div>
                <div className="space-y-2">
                  <input type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy" />
                  <textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)}
                    placeholder="Optional message to include in the email"
                    rows={2}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy resize-none" />
                  <button onClick={sendNotify} disabled={notifying || !notifyEmail.trim()}
                    className="w-full py-2 bg-im8-red text-white text-sm font-medium rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
                    {notifying ? "Sending..." : "Send notification"}
                  </button>
                </div>
              </div>

              {/* Comments */}
              <div className="border-t border-im8-stone/30 pt-5">
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-3">Comments</div>
                {commentsLoading ? (
                  <p className="text-xs text-im8-burgundy/40">Loading…</p>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-im8-burgundy/40">No comments yet.</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {comments.map(c => (
                      <div key={c.id} className="bg-im8-sand/40 rounded-lg p-3">
                        <div className="flex items-center justify-between text-xs text-im8-burgundy/60 mb-1">
                          <span className="font-medium">{c.author_display_name || "System"}</span>
                          <span>{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-im8-burgundy whitespace-pre-wrap">{c.body}</p>
                        {c.visible_to_partner && (
                          <div className="text-xs text-green-700 mt-1">Visible to agency/creator</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <textarea value={commentBody} onChange={e => setCommentBody(e.target.value)}
                  placeholder="Add a comment…"
                  rows={3}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy resize-none" />
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-xs text-im8-burgundy/70">
                    <input type="checkbox" checked={commentVisibleToPartner} onChange={e => setCommentVisibleToPartner(e.target.checked)} />
                    Share with submitter
                  </label>
                  <button onClick={postComment} disabled={!commentBody.trim()}
                    className="px-3 py-1.5 bg-im8-burgundy text-white text-sm rounded-lg hover:bg-im8-red transition-colors disabled:opacity-50">
                    Post comment
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
