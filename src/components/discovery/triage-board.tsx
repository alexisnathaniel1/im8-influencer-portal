"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type DiscoveryProfile = {
  id: string;
  status: string;
  source: string;
  influencer_name: string;
  submitter_name: string;
  submitter_agency: string | null;
  platform_primary: string;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  follower_count: number | null;
  proposed_rate_cents: number | null;
  niche: string[];
  ai_score: number | null;
  ai_summary: string | null;
  ai_red_flags: string[];
  created_at: string;
};

const STATUSES = ["new", "reviewing", "shortlisted", "rejected", "converted"];
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  reviewing: "bg-yellow-100 text-yellow-700",
  shortlisted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-im8-burgundy/30">—</span>;
  const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
  return <span className={`text-sm font-bold ${color}`}>{score}/100</span>;
}

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

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(currentFilters as Record<string, string>);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/discovery?${params.toString()}`);
  }

  async function updateStatus(profileId: string, newStatus: string) {
    setUpdating(profileId);
    await fetch(`/api/discovery/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setUpdating(null);
  }

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => applyFilter("status", "")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !currentFilters.status ? "bg-im8-burgundy text-white" : "bg-white border border-im8-stone text-im8-burgundy hover:bg-im8-sand"
          }`}>
          All ({statusCounts.reduce((a, b) => a + b.count, 0)})
        </button>
        {statusCounts.map(({ status, count }) => (
          <button key={status} onClick={() => applyFilter("status", status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              currentFilters.status === status
                ? "bg-im8-burgundy text-white"
                : "bg-white border border-im8-stone text-im8-burgundy hover:bg-im8-sand"
            }`}>
            {status} ({count})
          </button>
        ))}
      </div>

      {/* Search + platform filter */}
      <div className="flex gap-3">
        <input
          type="text" value={search} placeholder="Search by influencer name..."
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

      {/* Profile list */}
      {profiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No profiles yet. <Link href="/intake" target="_blank" className="text-im8-red hover:underline">Share your intake form</Link> to start receiving submissions.
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-im8-stone/30 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link href={`/admin/discovery/${p.id}`} className="font-semibold text-im8-burgundy hover:text-im8-red transition-colors">
                      {p.influencer_name}
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                    <span className="text-xs text-im8-burgundy/40 capitalize">{p.platform_primary}</span>
                    {p.ai_red_flags?.length > 0 && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        {p.ai_red_flags.length} flag{p.ai_red_flags.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-im8-burgundy/50 flex-wrap">
                    {p.instagram_handle && <span>IG: {p.instagram_handle}</span>}
                    {p.tiktok_handle && <span>TT: {p.tiktok_handle}</span>}
                    {p.follower_count && <span>{(p.follower_count / 1000).toFixed(0)}K followers</span>}
                    {p.proposed_rate_cents && <span>${(p.proposed_rate_cents / 100).toFixed(0)}/mo</span>}
                    <span>via {p.source.replace("_", " ")}</span>
                    {p.submitter_agency && <span>· {p.submitter_agency}</span>}
                  </div>
                  {p.niche?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {p.niche.map(n => (
                        <span key={n} className="text-xs bg-im8-sand text-im8-burgundy px-2 py-0.5 rounded-full">{n}</span>
                      ))}
                    </div>
                  )}
                  {p.ai_summary && (
                    <p className="text-xs text-im8-burgundy/60 mt-2 line-clamp-2">{p.ai_summary}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  <ScoreBadge score={p.ai_score} />
                  <div className="flex gap-2">
                    {p.status !== "shortlisted" && p.status !== "converted" && (
                      <button onClick={() => updateStatus(p.id, "shortlisted")} disabled={updating === p.id}
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50">
                        Shortlist
                      </button>
                    )}
                    {p.status !== "rejected" && (
                      <button onClick={() => updateStatus(p.id, "rejected")} disabled={updating === p.id}
                        className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
                        Reject
                      </button>
                    )}
                    {p.status === "shortlisted" && (
                      <Link href={`/admin/deals/new?profileId=${p.id}`}
                        className="text-xs px-3 py-1.5 bg-im8-red text-white rounded-lg hover:bg-im8-burgundy transition-colors">
                        → Create deal
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
