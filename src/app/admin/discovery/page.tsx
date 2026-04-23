import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import DiscoveryBoard from "@/components/discovery/triage-board";

const STATUSES = ["new", "reviewing", "negotiation_needed", "approved", "rejected", "converted"];

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; platform?: string; q?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  let query = admin
    .from("discovery_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);
  if (params.platform) query = query.eq("platform_primary", params.platform);
  if (params.q) query = query.ilike("influencer_name", `%${params.q}%`);

  const { data: profiles, error } = await query;
  if (error) console.error("[discovery]", error.message);

  // Count comments per profile in one round trip
  const profileIds = (profiles ?? []).map(p => p.id);
  const commentCounts = new Map<string, number>();
  if (profileIds.length > 0) {
    const { data: commentRows } = await admin
      .from("discovery_comments")
      .select("discovery_profile_id")
      .in("discovery_profile_id", profileIds);
    (commentRows ?? []).forEach(r => {
      commentCounts.set(r.discovery_profile_id, (commentCounts.get(r.discovery_profile_id) ?? 0) + 1);
    });
  }
  const profilesWithCounts = (profiles ?? []).map(p => ({
    ...p,
    comments_count: commentCounts.get(p.id) ?? 0,
  }));

  const statusCounts = await Promise.all(
    STATUSES.map(async s => {
      const { count } = await admin
        .from("discovery_profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", s);
      return { status: s, count: count ?? 0 };
    })
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-im8-burgundy">Discovery</h1>
          <p className="text-im8-burgundy/60 mt-1">Inbound creator profiles from agencies and self-submissions</p>
        </div>
        <div className="flex gap-3">
          <Link href="/intake" target="_blank"
            className="px-4 py-2 border border-im8-stone text-im8-burgundy text-sm rounded-lg hover:bg-im8-sand transition-colors">
            Open intake form ↗
          </Link>
          <Link href="/admin/deals/new"
            className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors">
            + Add manually
          </Link>
        </div>
      </div>

      <DiscoveryBoard profiles={profilesWithCounts} statusCounts={statusCounts} currentFilters={params} />
    </div>
  );
}
