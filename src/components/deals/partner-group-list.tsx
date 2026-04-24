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
  approved: "Pending Contract",
  contracted: "Active",
  live: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
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
}: {
  groups: CreatorGroup[];
  showRates: boolean;
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

        return (
          <div key={g.key} className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
            {/* Creator header — click left side to toggle */}
            <div className="flex items-center justify-between gap-4 px-5 py-3 bg-im8-sand/40 border-b border-im8-stone/20">
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
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-im8-stone/20">
                  <tr>
                    {[
                      "Contract",
                      "Platform",
                      "Status",
                      "Type",
                      ...(showRates ? ["Rate/mo"] : []),
                      "Duration",
                      "Start",
                      "Owner",
                      "Updated",
                      "",
                    ].map(h => (
                      <th
                        key={h}
                        className="text-left px-4 py-2 text-[10px] font-semibold text-im8-burgundy/50 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-im8-stone/20">
                  {g.deals.map(d => {
                    const social = primarySocialUrl(d);
                    return (
                      <tr key={d.id} className="hover:bg-im8-sand/20 transition-colors">
                        {/* Contract badge + View link */}
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/deals/${d.id}`}
                            className="inline-flex items-center gap-2 group"
                          >
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
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
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {STATUS_LABELS[d.status] ?? d.status.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Paid / Gifted */}
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3 text-im8-burgundy/60 text-xs">
                          {d.assigned_to?.full_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-im8-burgundy/40 text-xs">
                          {new Date(d.updated_at).toLocaleDateString()}
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
