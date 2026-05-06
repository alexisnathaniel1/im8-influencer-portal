import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import DealsFilterBar from "@/components/deals/deals-filter-bar";
import PartnerGroupList, { type CreatorGroup } from "@/components/deals/partner-group-list";
import { canViewRates } from "@/lib/permissions";

// Statuses that belong in Partner Tracker.
// "pending_approval" = waiting for management review (comes from Discovery approve flow).
// "approved"         = management approved, awaiting contract signing.
// "contracted/live"  = active partnership.
// "completed"        = finished.
// NOTE: "cancelled" requires the deal_status enum to include it
// (run: ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'cancelled').
const TRACKER_STATUSES_CORE = ["pending_approval", "approved", "contracted", "live", "completed"] as const;

// Active deal statuses — these groups start expanded
const ACTIVE_STATUSES = new Set(["pending_approval", "approved", "contracted", "live"]);

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

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    platform?: string;
    type?: string;
    contractFrom?: string;
    contractTo?: string;
  }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const showRates = canViewRates(profile?.role ?? "");

  const admin = createAdminClient();

  // Determine which DB statuses to include based on the simplified filter value.
  // We always use only the CORE statuses in the .in() call to avoid crashing if
  // "cancelled" hasn't been added to the deal_status enum yet.
  let statusFilter: string[];
  const s = params.status ?? "";
  if (s === "in_approval" || s === "pending_approval") {
    statusFilter = ["pending_approval"];
  } else if (s === "pending_contract" || s === "approved") {
    statusFilter = ["approved"];
  } else if (s === "active" || s === "contracted" || s === "live") {
    statusFilter = ["contracted", "live"];
  } else if (s === "completed") {
    statusFilter = ["completed"];
  } else {
    // Default: show all partner tracker statuses
    statusFilter = [...TRACKER_STATUSES_CORE];
  }

  let query = admin
    .from("deals")
    .select("*, assigned_to:assigned_to(full_name)")
    .in("status", statusFilter)
    .order("updated_at", { ascending: false });

  if (params.platform) query = query.eq("platform_primary", params.platform);
  if (params.type === "paid") query = query.eq("is_gifted", false);
  if (params.type === "gifted") query = query.eq("is_gifted", true);
  if (params.contractFrom) query = query.gte("campaign_start", params.contractFrom);
  if (params.contractTo) query = query.lte("campaign_start", params.contractTo);
  if (params.q) {
    query = query.or(
      `influencer_name.ilike.%${params.q}%,agency_name.ilike.%${params.q}%`
    );
  }

  const { data: dealsData } = await query;
  const deals = (dealsData ?? []) as DealRow[];

  // Fetch deliverable counts per deal so each contract row can show
  // "X/Y done" alongside the status. Same query pattern as Roster.
  const dealIds = deals.map(d => d.id);
  const { data: deliverableRows } = dealIds.length
    ? await admin.from("deliverables").select("deal_id, status").in("deal_id", dealIds)
    : { data: [] as { deal_id: string; status: string }[] };

  // "Done" = approved/live/completed — same set as Roster + deal-detail page.
  const DONE_STATUSES = new Set(["approved", "live", "completed"]);
  const progressByDeal = new Map<string, { total: number; done: number }>();
  for (const r of deliverableRows ?? []) {
    const id = r.deal_id as string;
    const cur = progressByDeal.get(id) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (DONE_STATUSES.has(r.status as string)) cur.done += 1;
    progressByDeal.set(id, cur);
  }

  // Group deals by creator (profile_id if linked, name as fallback)
  const groupMap = new Map<
    string,
    { key: string; label: string; agency: string | null; deals: DealRow[] }
  >();
  for (const d of deals) {
    const key = d.influencer_profile_id ?? `name:${d.influencer_name}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { key, label: d.influencer_name, agency: d.agency_name, deals: [] });
    }
    groupMap.get(key)!.deals.push(d);
  }

  // Sort contracts within each group ascending (Contract 1 first)
  for (const g of groupMap.values()) {
    g.deals.sort((a, b) => (a.contract_sequence ?? 1) - (b.contract_sequence ?? 1));
  }

  // Build final groups with isActive flag; sort: active groups first, then by most recent activity
  const creatorGroups: CreatorGroup[] = Array.from(groupMap.values())
    .map(g => ({
      ...g,
      isActive: g.deals.some(d => ACTIVE_STATUSES.has(d.status)),
    }))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aLatest = Math.max(...a.deals.map(d => new Date(d.updated_at).getTime()));
      const bLatest = Math.max(...b.deals.map(d => new Date(d.updated_at).getTime()));
      return bLatest - aLatest;
    });

  const totalPartners = creatorGroups.length;
  const totalContracts = deals.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-im8-burgundy">Partner Tracker</h1>
          <p className="text-im8-burgundy/60 mt-1">
            {totalPartners} partner{totalPartners === 1 ? "" : "s"} ·{" "}
            {totalContracts} contract{totalContracts === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/deals/bulk-upload"
            className="px-4 py-2 border border-im8-stone/40 text-im8-burgundy text-sm rounded-lg hover:bg-im8-offwhite transition-colors"
          >
            ↑ Bulk upload
          </Link>
          <Link
            href="/admin/deals/new"
            className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors"
          >
            + New partnership
          </Link>
        </div>
      </div>

      <DealsFilterBar current={params} />

      {/* key forces remount (reset accordion state) when filters change */}
      <PartnerGroupList
        key={JSON.stringify(params)}
        groups={creatorGroups}
        showRates={showRates}
        progressByDeal={Object.fromEntries(progressByDeal)}
      />
    </div>
  );
}
