"use client";

import { useState } from "react";
import Link from "next/link";
import DealDeleteButton from "@/components/deals/deal-delete-button";

type DealRow = {
  id: string;
  status: string;
  influencer_name: string;
  influencer_profile_id: string | null;
  agency_name: string | null;
  platform_primary: string;
  monthly_rate_cents: number | null;
  total_months: number | null;
  contract_sequence: number | null;
  previous_deal_id: string | null;
  is_gifted: boolean | null;
  campaign_start: string | null;
  updated_at: string;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
  contract_url: string | null;
  drive_folder_id: string | null;
  assigned_to: { full_name: string } | null;
};

export type CreatorGroup = {
  key: string;
  label: string;
  agency: string | null;
  deals: DealRow[];
  isActive: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "In Approval",
  approved: "Pending Contract",
  contracted: "Active",
  live: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-blue-50 text-blue-600",
  approved: "bg-amber-100 text-amber-700",
  contracted: "bg-emerald-100 text-emerald-700",
  live: "bg-emerald-100 text-emerald-700",
  completed: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-50 text-red-400",
};

function primarySocialUrl(d: DealRow): { url: string; label: string } | null {
  const platform = d.platform_primary;
  if (platform === "instagram" && d.instagram_handle)
    return { url: `https://instagram.com/${d.instagram_handle.replace(/^@/, "")}`, label: "Instagram" };
  if (platform === "tiktok" && d.tiktok_handle)
    return { url: `https://tiktok.com/@${d.tiktok_handle.replace(/^@/, "")}`, label: "TikTok" };
  if (platform === "youtube" && d.youtube_handle)
    return { url: `https://youtube.com/@${d.youtube_handle.replace(/^@/, "")}`, label: "YouTube" };
  // fallback to any handle
  if (d.instagram_handle) return { url: `https://instagram.com/${d.instagram_handle.replace(/^@/, "")}`, label: "Instagram" };
  if (d.tiktok_handle) return { url: `https://tiktok.com/@${d.tiktok_handle.replace(/^@/, "")}`, label: "TikTok" };
  if (d.youtube_handle) return { url: `https://youtube.com/@${d.youtube_handle.replace(/^@/, "")}`, label: "YouTube" };
  return null;
}

export default function PartnerGroupList({
  groups,
  showRates,
  progressByDeal,
}: {
  groups: CreatorGroup[];
  showRates: boolean;
  // dealId -> { total, done } so each row can render its deliverable progress
  progressByDeal?: Record<string, { total: number; done: number }>;
}) {
  // Active groups open by default; archived-only groups collapsed by default
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map(g => [g.key, g.isActive]))
  );

  function toggle(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
        No partnerships match these filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(g => {
        const isOpen = expanded[g.key] ?? g.isActive;
        const mostRecentDeal = g.deals[g.deals.length - 1];

        // Aggregate progress across all of this creator's contracts so the
        // group header can show "5/12 done" at a glance.
        let groupTotal = 0;
        let groupDone = 0;
        for (const d of g.deals) {
          const p = progressByDeal?.[d.id];
          if (p) {
            groupTotal += p.total;
            groupDone += p.done;
          }
        }

        return (
          <div key={g.key} className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
            {/* Creator header — click left side to toggle */}
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-im8-offwhite border-b border-im8-stone/20">
              <button
                onClick={() => toggle(g.key)}
                className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-im8-burgundy truncate">{g.label}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-im8-burgundy/10 text-im8-burgundy font-medium">
                    {g.deals.length} contract{g.deals.length === 1 ? "" : "s"}
                  </span>
                  {g.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                      Active
                    </span>
                  )}
                  {groupTotal > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium tabular-nums ${
                        groupDone === groupTotal
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-im8-offwhite text-im8-burgundy/70"
                      }`}
                      title={`${groupDone} of ${groupTotal} deliverables live`}
                    >
                      {groupDone}/{groupTotal} done
                    </span>
                  )}
                  <span className="text-[11px] text-im8-burgundy/30 ml-0.5" aria-hidden>
                    {isOpen ? "▲" : "▼ Show contracts"}
                  </span>
                </div>
                {g.agency && (
                  <p className="text-xs text-im8-burgundy/50 mt-0.5">via {g.agency}</p>
                )}
              </button>

              <Link
                href={`/admin/deals/new-contract?from=${mostRecentDeal.id}`}
                className="shrink-0 text-xs px-3 py-1.5 bg-im8-burgundy text-white rounded-lg hover:bg-im8-red transition-colors font-medium"
              >
                + New contract
              </Link>
            </div>

            {/* Contracts table — visible when expanded */}
            {isOpen && (
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-white border-b border-im8-stone/20">
                  <tr>
                    {[
                      "Contract",
                      "Platform",
                      "Status",
                      "Progress",
                      "Type",
                      ...(showRates ? ["Rate/mo"] : []),
                      "Duration",
                      "Start",
                      "Owner",
                      "Updated",
                      "Doc",
                      "Drive",
                      "",
                    ].map(h => (
                      <th
                        key={h}
                        className="text-left px-5 py-2.5 text-[11px] font-semibold text-im8-muted uppercase tracking-[0.07em]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-im8-stone/20">
                  {g.deals.map(d => {
                    const social = primarySocialUrl(d);
                    const dealProgress = progressByDeal?.[d.id];
                    return (
                      <tr key={d.id} className="hover:bg-im8-offwhite transition-colors">
                        {/* Contract badge + View link */}
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/admin/deals/${d.id}`}
                            className="inline-flex items-center gap-2 group"
                          >
                            <span className="text-xs px-2 py-0.5 rounded-[6px] bg-im8-burgundy/10 text-im8-burgundy font-semibold whitespace-nowrap">
                              Contract {d.contract_sequence ?? 1}
                            </span>
                            <span className="text-xs text-im8-burgundy/40 group-hover:text-im8-red group-hover:underline">
                              View →
                            </span>
                          </Link>
                        </td>

                        {/* Platform — links to social profile if a handle exists */}
                        <td className="px-4 py-3 text-xs">
                          {social ? (
                            <a
                              href={social.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-im8-burgundy/60 hover:text-im8-red hover:underline capitalize inline-flex items-center gap-0.5"
                            >
                              {d.platform_primary}
                              <span className="text-[10px] opacity-60">↗</span>
                            </a>
                          ) : (
                            <span className="text-im8-burgundy/60 capitalize">{d.platform_primary}</span>
                          )}
                        </td>

                        {/* Status — simplified label */}
                        <td className="px-5 py-3.5">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-[6px] font-medium whitespace-nowrap ${
                              STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {STATUS_LABELS[d.status] ?? d.status.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Progress — N/M done with bar + month X of Y */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <DealProgress
                            done={dealProgress?.done ?? 0}
                            total={dealProgress?.total ?? 0}
                            campaignStart={d.campaign_start}
                            totalMonths={d.total_months}
                          />
                        </td>

                        {/* Paid / Gifted */}
                        <td className="px-5 py-3.5">
                          {d.is_gifted ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                              Gifted
                            </span>
                          ) : (
                            <span className="text-xs text-im8-burgundy/40">Paid</span>
                          )}
                        </td>

                        {/* Rate (role-gated) */}
                        {showRates && (
                          <td className="px-4 py-3 text-im8-burgundy text-xs">
                            {d.is_gifted
                              ? "—"
                              : d.monthly_rate_cents
                              ? `$${(d.monthly_rate_cents / 100).toLocaleString()}`
                              : "—"}
                          </td>
                        )}

                        <td className="px-4 py-3 text-im8-burgundy/70 text-xs">
                          {d.total_months ? `${d.total_months}mo` : "—"}
                        </td>
                        <td className="px-4 py-3 text-im8-burgundy/60 text-xs">
                          {d.campaign_start
                            ? new Date(d.campaign_start).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-im8-burgundy/60 text-xs whitespace-nowrap">
                          {d.assigned_to?.full_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-im8-burgundy/40 text-xs">
                          {new Date(d.updated_at).toLocaleDateString()}
                        </td>
                        {/* Contract document — Google Drive link to signed contract */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {d.contract_url ? (
                            <a
                              href={d.contract_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-im8-red hover:underline"
                              title="Open signed contract"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Contract
                            </a>
                          ) : (
                            <span className="text-xs text-im8-burgundy/30">—</span>
                          )}
                        </td>
                        {/* Partner Drive folder */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {d.drive_folder_id ? (
                            <a
                              href={`https://drive.google.com/drive/folders/${d.drive_folder_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open partner Drive folder"
                              className="inline-flex items-center gap-1 text-xs text-im8-burgundy/60 hover:text-[#4285F4] transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M4.5 19.5L9 12l4.5 7.5H4.5zM19.5 19.5l-3-7.5H12l3 7.5h4.5zM12 4.5L8.25 12h7.5L12 4.5z"/>
                              </svg>
                              Drive
                            </a>
                          ) : (
                            <span className="text-xs text-im8-burgundy/20">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DealDeleteButton
                            dealId={d.id}
                            contractLabel={`Contract ${d.contract_sequence ?? 1} (${g.label})`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}

            {/* Collapsed state — subtle summary row */}
            {!isOpen && (
              <div className="px-5 py-2.5 text-xs text-im8-burgundy/35 italic">
                {g.deals.length} contract{g.deals.length === 1 ? "" : "s"} — click to expand
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Inline contract progress: progress bar + N/M done + "Month X of Y".
// Mirrors the Roster ProgressCell but compact for table rows.
function DealProgress({
  done,
  total,
  campaignStart,
  totalMonths,
}: {
  done: number;
  total: number;
  campaignStart: string | null;
  totalMonths: number | null;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const allDone = total > 0 && done === total;

  // Month X of Y — current contract month based on today vs campaign_start
  let month: { current: number; total: number } | null = null;
  if (campaignStart && totalMonths) {
    const start = new Date(campaignStart);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today >= start) {
      const monthsElapsed = Math.floor(
        (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
      );
      month = { current: Math.min(monthsElapsed + 1, totalMonths), total: totalMonths };
    }
  }

  if (total === 0 && !month) {
    return <span className="text-im8-burgundy/30 text-xs">—</span>;
  }

  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      {total > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-im8-stone/40 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${allDone ? "bg-emerald-500" : "bg-im8-burgundy"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-im8-burgundy tabular-nums">
            {done}/{total}
          </span>
        </div>
      )}
      {month && (
        <div className="text-[10px] text-im8-burgundy/50">
          Month {month.current} of {month.total}
        </div>
      )}
    </div>
  );
}
