import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import DealDetailClient from "@/components/deals/deal-detail-client";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  const { data: deal } = await admin
    .from("deals")
    .select("*, assigned_to(id, full_name), influencer_profile_id(id, full_name, email, drive_folder_url)")
    .eq("id", id)
    .single();

  if (!deal) notFound();

  const { data: briefs } = await admin.from("briefs").select("*").eq("deal_id", id).order("created_at");
  const { data: submissions } = await admin
    .from("submissions")
    .select("*, ai_reviews(status, recommendation, framework_score, authenticity_score, algorithm_score)")
    .eq("deal_id", id)
    .order("submitted_at", { ascending: false });

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/deals" className="text-im8-burgundy/50 hover:text-im8-burgundy text-sm">← Deals</Link>
        <span className="text-im8-burgundy/30">/</span>
        <h1 className="text-2xl font-bold text-im8-burgundy">{deal.influencer_name}</h1>
      </div>

      <DealDetailClient deal={deal} briefs={briefs ?? []} submissions={submissions ?? []} />
    </div>
  );
}
