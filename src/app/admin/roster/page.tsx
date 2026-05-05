import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import RosterTable, { type RosterRow } from "./roster-table";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ expiring?: string }>;
}) {
  const params = await searchParams;
  const expiringOnly = params.expiring === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  const { data: deals } = await admin
    .from("deals")
    .select(`
      id, influencer_name, influencer_email, agency_name,
      platform_primary, instagram_handle, tiktok_handle, youtube_handle,
      follower_count, niche_tags,
      monthly_rate_cents, total_months, total_rate_cents,
      campaign_start, campaign_end, status,
      contract_sequence,
      assigned_to(full_name)
    `)
    .in("status", ["pending_approval", "approved", "contracted", "live"])
    .order("influencer_name");

  // Fetch deliverable counts per deal so we can show "X/Y done" progress
  // alongside each row without a second click. Single bulk query is cheaper
  // than per-row fetches.
  const dealIds = (deals ?? []).map((d) => d.id as string);
  const { data: deliverableRows } = dealIds.length
    ? await admin
        .from("deliverables")
        .select("deal_id, status")
        .in("deal_id", dealIds)
    : { data: [] as { deal_id: string; status: string }[] };

  const progressByDeal = new Map<string, { total: number; done: number }>();
  for (const r of deliverableRows ?? []) {
    const id = r.deal_id as string;
    const cur = progressByDeal.get(id) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (r.status === "live" || r.status === "completed") cur.done += 1;
    progressByDeal.set(id, cur);
  }

  const rows: RosterRow[] = (deals ?? []).map((d) => {
    const assigned = d.assigned_to as unknown as { full_name: string } | null;
    const progress = progressByDeal.get(d.id as string) ?? { total: 0, done: 0 };
    return {
      id: d.id as string,
      influencerName: (d.influencer_name as string) ?? "—",
      influencerEmail: (d.influencer_email as string | null) ?? null,
      agencyName: (d.agency_name as string | null) ?? null,
      platform: (d.platform_primary as string | null) ?? null,
      instagramHandle: (d.instagram_handle as string | null) ?? null,
      tiktokHandle: (d.tiktok_handle as string | null) ?? null,
      youtubeHandle: (d.youtube_handle as string | null) ?? null,
      followerCount: (d.follower_count as number | null) ?? null,
      nicheTags: (d.niche_tags as string[] | null) ?? [],
      monthlyRateCents: (d.monthly_rate_cents as number | null) ?? null,
      totalMonths: (d.total_months as number | null) ?? null,
      totalRateCents: (d.total_rate_cents as number | null) ?? null,
      campaignStart: (d.campaign_start as string | null) ?? null,
      campaignEnd: (d.campaign_end as string | null) ?? null,
      status: (d.status as string) ?? "pending_approval",
      contractSequence: (d.contract_sequence as number | null) ?? 1,
      pic: assigned?.full_name ?? null,
      deliverablesTotal: progress.total,
      deliverablesDone: progress.done,
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-[40px] leading-tight font-bold text-im8-maroon">Roster</h1>
        <p className="text-im8-muted mt-1 text-[14px]">
          Active influencer roster — filter by rate, platform, niche, status, or expiry window.
        </p>
      </div>

      <RosterTable rows={rows} initialExpiringOnly={expiringOnly} />
    </div>
  );
}
