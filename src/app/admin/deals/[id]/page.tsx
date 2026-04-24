import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import DealDetailClient from "@/components/deals/deal-detail-client";
import { canViewRates } from "@/lib/permissions";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const showRates = canViewRates(profile?.role ?? "");

  const admin = createAdminClient();

  const { data: deal } = await admin
    .from("deals")
    .select("*, assigned_to(id, full_name), influencer_profile_id(id, full_name, email, drive_folder_url)")
    .eq("id", id)
    .single();

  if (!deal) notFound();

  const [{ data: briefs }, { data: submissions }, { data: giftingRequests }, { data: deliverables }] = await Promise.all([
    admin.from("briefs").select("*").eq("deal_id", id).order("created_at"),
    admin
      .from("submissions")
      .select("*")
      .eq("deal_id", id)
      .order("submitted_at", { ascending: false }),
    admin
      .from("gifting_requests")
      .select("*")
      .eq("deal_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("deliverables")
      .select("id, deliverable_type, sequence, title, status, due_date, brief_doc_url")
      .eq("deal_id", id)
      .order("deliverable_type", { ascending: true })
      .order("sequence", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  // Fetch partner shipping address if linked to a profile
  let partnerShippingAddress: Record<string, string> | null = null;
  const profileId = (deal.influencer_profile_id as { id?: string } | null)?.id ?? deal.influencer_profile_id as string | null;
  if (profileId) {
    const { data: partnerProfile } = await admin
      .from("profiles")
      .select("shipping_address_json")
      .eq("id", profileId)
      .single();
    partnerShippingAddress = (partnerProfile?.shipping_address_json as Record<string, string>) ?? null;
  }

  // Lookup previous contract for the breadcrumb link
  const contractSeq = (deal.contract_sequence as number | null) ?? 1;
  const prevDealId = deal.previous_deal_id as string | null;
  let prevContract: { id: string; contract_sequence: number | null; status: string } | null = null;
  if (prevDealId) {
    const { data: prev } = await admin
      .from("deals")
      .select("id, contract_sequence, status")
      .eq("id", prevDealId)
      .single();
    prevContract = prev ?? null;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/deals" className="text-im8-burgundy/50 hover:text-im8-burgundy text-sm">← Partner Tracker</Link>
        <span className="text-im8-burgundy/30">/</span>
        <h1 className="text-2xl font-bold text-im8-burgundy">{deal.influencer_name}</h1>
        <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold">
          Contract {contractSeq}
        </span>
        {prevContract && (
          <Link
            href={`/admin/deals/${prevContract.id}`}
            className="text-xs text-im8-burgundy/50 hover:text-im8-red hover:underline"
          >
            ← Contract {prevContract.contract_sequence ?? 1} ({prevContract.status.replace("_", " ")})
          </Link>
        )}
      </div>

      <DealDetailClient
        deal={deal}
        briefs={briefs ?? []}
        submissions={submissions ?? []}
        giftingRequests={giftingRequests ?? []}
        deliverables={deliverables ?? []}
        partnerShippingAddress={partnerShippingAddress}
        canViewRates={showRates}
      />
    </div>
  );
}
