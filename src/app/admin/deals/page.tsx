import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import DealsFilterBar from "@/components/deals/deals-filter-bar";
import { canViewRates } from "@/lib/permissions";

const STATUS_COLORS: Record<string, string> = {
  contacted: "bg-gray-100 text-gray-600",
  negotiating: "bg-blue-100 text-blue-700",
  agreed: "bg-yellow-100 text-yellow-700",
  pending_approval: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  contracted: "bg-purple-100 text-purple-700",
  live: "bg-emerald-100 text-emerald-700",
  completed: "bg-gray-100 text-gray-500",
  declined: "bg-red-50 text-red-400",
};

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
  assigned_to: { full_name: string } | null;
};

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; platform?: string; type?: string; contractFrom?: string; contractTo?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const showRates = canViewRates(profile?.role ?? "");

  const admin = createAdminClient();

  let query = admin
    .from("deals")
    .select("*, assigned_to:assigned_to(full_name)")
    .order("updated_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);
  if (params.platform) query = query.eq("platform_primary", params.platform);
  if (params.type === "paid") query = query.eq("is_gifted", false);
  if (params.type === "gifted") query = query.eq("is_gifted", true);
  if (params.contractFrom) query = query.gte("campaign_start", params.contractFrom);
  if (params.contractTo) query = query.lte("campaign_start", params.contractTo);
  if (params.q) {
    query = query.or(`influencer_name.ilike.%${params.q}%,agency_name.ilike.%${params.q}%`);
  }

  const { data: dealsData } = await query;
  const deals = (dealsData ?? []) as DealRow[];

  // Group deals by creator: profile_id if linked, otherwise name as fallback
  const groups = new Map<string, { key: string; label: string; agency: string | null; deals: DealRow[] }>();
  for (const d of deals) {
    const key = d.influencer_profile_id ?? `name:${d.influencer_name}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: d.influencer_name,
        agency: d.agency_name,
        deals: [],
      });
    }
    groups.get(key)!.deals.push(d);
  }
  // Sort contracts within each group ascending (Contract 1 first)
  for (const g of groups.values()) {
    g.deals.sort((a, b) => (a.contract_sequence ?? 1) - (b.contract_sequence ?? 1));
  }
  // Sort groups by most recent activity across their contracts (desc)
  const groupList = Array.from(groups.values()).sort((a, b) => {
    const aLatest = Math.max(...a.deals.map(d => new Date(d.updated_at).getTime()));
    const bLatest = Math.max(...b.deals.map(d => new Date(d.updated_at).getTime()));
    return bLatest - aLatest;
  });

  const totalPartners = groupList.length;
  const totalContracts = deals.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-im8-burgundy">Partner Tracker</h1>
          <p className="text-im8-burgundy/60 mt-1">
            {totalPartners} partner{totalPartners === 1 ? "" : "s"} · {totalContracts} contract{totalContracts === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/deals/new"
          className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors">
          + New partnership
        </Link>
      </div>

      <DealsFilterBar current={params} />

      {groupList.length === 0 ? (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No partnerships match these filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groupList.map(g => {
            const mostRecentDeal = g.deals[g.deals.length - 1];
            const isActivePartner = g.deals.some(d => ["live", "contracted", "approved"].includes(d.status));
            return (
              <div key={g.key} className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between gap-4 px-5 py-3 bg-im8-sand/40 border-b border-im8-stone/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-im8-burgundy truncate">{g.label}</h2>
                      {g.agency && (
                        <span className="text-xs text-im8-burgundy/50">via {g.agency}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-im8-burgundy/10 text-im8-burgundy font-medium">
                        {g.deals.length} contract{g.deals.length === 1 ? "" : "s"}
                      </span>
                      {isActivePartner && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/admin/deals/new-contract?from=${mostRecentDeal.id}`}
                    className="shrink-0 text-xs px-3 py-1.5 bg-im8-burgundy text-white rounded-lg hover:bg-im8-red transition-colors font-medium"
                  >
                    + New contract
                  </Link>
                </div>

                {/* Contracts table */}
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-im8-stone/20">
                    <tr>
                      {["Contract", "Platform", "Status", "Type", ...(showRates ? ["Rate/mo"] : []), "Duration", "Start", "Owner", "Updated"].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold text-im8-burgundy/50 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-im8-stone/20">
                    {g.deals.map(d => (
                      <tr key={d.id} className="hover:bg-im8-sand/20 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/deals/${d.id}`} className="inline-flex items-center gap-2 group">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                              Contract {d.contract_sequence ?? 1}
                            </span>
                            <span className="text-xs text-im8-burgundy/40 group-hover:text-im8-red group-hover:underline">
                              View →
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-im8-burgundy/60 capitalize text-xs">{d.platform_primary}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[d.status] ?? ""}`}>
                            {d.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {d.is_gifted
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Gifted</span>
                            : <span className="text-xs text-im8-burgundy/40">Paid</span>}
                        </td>
                        {showRates && (
                          <td className="px-4 py-3 text-im8-burgundy text-xs">
                            {d.is_gifted ? "—" : d.monthly_rate_cents ? `$${(d.monthly_rate_cents / 100).toLocaleString()}` : "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-im8-burgundy/70 text-xs">
                          {d.total_months ? `${d.total_months}mo` : "—"}
                        </td>
                        <td className="px-4 py-3 text-im8-burgundy/60 text-xs">
                          {d.campaign_start ? new Date(d.campaign_start).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-im8-burgundy/60 text-xs">
                          {d.assigned_to?.full_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-im8-burgundy/40 text-xs">
                          {new Date(d.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
