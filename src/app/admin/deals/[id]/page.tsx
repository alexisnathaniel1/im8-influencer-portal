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

  // Fetch management feedback comments for this deal. Per-creator decisions
  // and notes left via the public review site are stored in approval_comments
  // with the creator's name prefixed in square brackets, e.g.
  //   "[Agency Creator 1] Approved: looks great"
  // We surface them on the deal page so the team reviewing the contract can
  // see exactly what each manager said about *this* creator without having
  // to dig through the batch's full thread.
  type MgmtFeedback = { id: string; author_display_name: string | null; body: string; kind: string; created_at: string; packet_id: string };
  let managementFeedback: MgmtFeedback[] = [];
  const influencerName = (deal.influencer_name as string | null)?.trim();
  if (influencerName) {
    // Find packets that include this deal id, then fetch their approval_comments
    // whose body starts with [<influencer_name>].
    const { data: relatedPackets } = await admin
      .from("approval_packets")
      .select("id")
      .contains("deal_ids", [id]);
    const packetIds = (relatedPackets ?? []).map((p) => p.id as string);
    if (packetIds.length > 0) {
      const { data: comments } = await admin
        .from("approval_comments")
        .select("id, author_display_name, body, kind, created_at, packet_id")
        .in("packet_id", packetIds)
        .ilike("body", `[${influencerName}]%`)
        .order("created_at", { ascending: false });
      managementFeedback = (comments ?? []) as MgmtFeedback[];
    }
  }

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
        <span className="text-xs px-2.5 py-1 rounded-[6px] bg-im8-burgundy/10 text-im8-burgundy font-semibold">
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
        role={profile?.role ?? ""}
        managementFeedback={managementFeedback}
      />
    </div>
  );
}
