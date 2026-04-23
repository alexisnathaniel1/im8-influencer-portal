import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit/log";

// POST /api/deals/[id]/new-contract
//
// Creates a new deal that follows an existing deal (same creator, next
// contract in sequence). The [id] param is the SOURCE deal (the prior
// contract). Rate / duration / deliverables come from the form body.
//
// Inherits creator identity from the source deal so admins don't have
// to re-enter handles etc.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceDealId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Auth: admin/management/support only
  const { data: actorProfile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!actorProfile || !["admin", "management", "support"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    rate_usd,
    total_months,
    deliverables,
    rationale,
  } = body as {
    rate_usd: number | null;
    total_months: number;
    deliverables: Array<{ code: string; count: number }>;
    rationale: string | null;
  };

  if (!rate_usd || rate_usd <= 0) {
    return NextResponse.json({ error: "Monthly rate is required" }, { status: 400 });
  }
  if (!total_months || total_months <= 0) {
    return NextResponse.json({ error: "Duration is required" }, { status: 400 });
  }
  if (!Array.isArray(deliverables) || deliverables.length === 0) {
    return NextResponse.json({ error: "At least one deliverable is required" }, { status: 400 });
  }

  // Load the source deal
  const { data: source, error: sourceErr } = await admin
    .from("deals")
    .select("*")
    .eq("id", sourceDealId)
    .single();

  if (sourceErr || !source) {
    return NextResponse.json({ error: "Source deal not found" }, { status: 404 });
  }

  // Compute next contract_sequence for this creator.
  // Use max(contract_sequence) + 1 scoped by influencer_profile_id if available,
  // otherwise by influencer_name (legacy safety).
  let nextSeq = (source.contract_sequence ?? 0) + 1;
  if (source.influencer_profile_id) {
    const { data: existingDeals } = await admin
      .from("deals")
      .select("contract_sequence")
      .eq("influencer_profile_id", source.influencer_profile_id)
      .order("contract_sequence", { ascending: false })
      .limit(1);
    if (existingDeals && existingDeals.length > 0) {
      nextSeq = (existingDeals[0].contract_sequence ?? 0) + 1;
    }
  }

  const rate_cents = Math.round(rate_usd * 100);

  // Create the new deal inheriting creator identity
  const { data: newDeal, error: insertErr } = await admin
    .from("deals")
    .insert({
      influencer_profile_id: source.influencer_profile_id,
      discovery_profile_id: null, // repeat contract — not from Discovery
      status: "pending_approval",
      // Inherited identity
      influencer_name: source.influencer_name,
      influencer_email: source.influencer_email,
      agency_name: source.agency_name,
      platform_primary: source.platform_primary,
      instagram_handle: source.instagram_handle,
      tiktok_handle: source.tiktok_handle,
      youtube_handle: source.youtube_handle,
      follower_count: source.follower_count,
      niche_tags: source.niche_tags ?? [],
      // Editable terms
      deliverables,
      monthly_rate_cents: rate_cents,
      total_months,
      rationale: rationale ?? null,
      // Linkage
      contract_sequence: nextSeq,
      previous_deal_id: sourceDealId,
      // Ownership
      assigned_to: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !newDeal) {
    console.error("[new-contract] insert failed:", insertErr);
    return NextResponse.json({ error: insertErr?.message ?? "Failed to create contract" }, { status: 500 });
  }

  // Create a matching approval packet so the new contract appears in the queue
  const { error: packetErr } = await admin.from("approval_packets").insert({
    created_by: user.id,
    title: `${source.influencer_name} — Contract ${nextSeq}`,
    status: "pending",
    deal_ids: [newDeal.id],
    approver_ids: [],
    required_approvals: 3,
    approved_count: 0,
    rejected_count: 0,
  });
  if (packetErr) {
    console.error("[new-contract] approval_packet insert failed:", packetErr);
    // Non-fatal — the deal still exists; admin can recreate the packet manually
  }

  await logAuditEvent({
    actorId: user.id,
    entityType: "deal",
    entityId: newDeal.id,
    action: `contract_${nextSeq}_created_from_${sourceDealId}`,
    after: {
      source_deal_id: sourceDealId,
      contract_sequence: nextSeq,
      monthly_rate_cents: rate_cents,
      total_months,
    },
  });

  return NextResponse.json({
    success: true,
    deal_id: newDeal.id,
    contract_sequence: nextSeq,
  });
}
