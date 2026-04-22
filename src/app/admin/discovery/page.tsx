import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import DiscoveryBoard from "@/components/discovery/triage-board";

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; platform?: string; q?: string }>;
}) {
  const params = await searchParams;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Use admin client for data queries to bypass RLS on server-side admin pages
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

  const statusCounts = await Promise.all(
    ["new", "reviewing", "shortlisted", "rejected", "converted"].map(async s => {
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
          <p className="text-im8-burgundy/60 mt-1">Inbound influencer profiles</p>
        </div>
        <div className="flex gap-3">
          <Link href="/intake" target="_blank"
            className="px-4 py-2 border border-im8-stone text-im8-burgundy text-sm rounded-lg hover:bg-im8-sand transition-colors">
            Share intake form ↗
          </Link>
          <Link href="/admin/deals/new"
            className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors">
            + Add manually
          </Link>
        </div>
      </div>

      <DiscoveryBoard profiles={profiles ?? []} statusCounts={statusCounts} currentFilters={params} />
    </div>
  );
}
