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

  const { data: deals } = await query;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-im8-burgundy">Partner Tracker</h1>
          <p className="text-im8-burgundy/60 mt-1">{deals?.length ?? 0} partners</p>
        </div>
        <Link href="/admin/deals/new"
          className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors">
          + New partnership
        </Link>
      </div>

      <DealsFilterBar current={params} />

      <div className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
        {!deals?.length ? (
          <div className="p-12 text-center text-im8-burgundy/40">No deals match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-im8-sand/50 border-b border-im8-stone/30">
              <tr>
                {["Influencer", "Platform", "Status", "Type", ...(showRates ? ["Rate/mo"] : []), "Contract start", "Owner", "Updated"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-im8-stone/20">
              {deals.map(d => (
                <tr key={d.id} className="hover:bg-im8-sand/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/deals/${d.id}`} className="font-medium text-im8-burgundy hover:text-im8-red">
                      {d.influencer_name}
                    </Link>
                    {d.agency_name && <div className="text-xs text-im8-burgundy/40">{d.agency_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-im8-burgundy/60 capitalize">{d.platform_primary}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[d.status] ?? ""}`}>
                      {d.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {d.is_gifted
                      ? <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">Gifted</span>
                      : <span className="text-xs text-im8-burgundy/40">Paid</span>}
                  </td>
                  {showRates && (
                    <td className="px-4 py-3 text-im8-burgundy">
                      {d.is_gifted ? "—" : d.monthly_rate_cents ? `$${(d.monthly_rate_cents / 100).toFixed(0)}` : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-im8-burgundy/60 text-xs">
                    {d.campaign_start ? new Date(d.campaign_start).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-im8-burgundy/60 text-xs">
                    {(d.assigned_to as { full_name: string } | null)?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-im8-burgundy/40 text-xs">
                    {new Date(d.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
