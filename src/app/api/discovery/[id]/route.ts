import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("discovery_profiles").select("*").eq("id", id).single();
  return NextResponse.json({ profile });
}

const STATUS_LABELS: Record<string, string> = {
  new: "Submitted",
  reviewing: "Under Review",
  negotiation_needed: "Negotiation Needed",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Pending MGMT Approval",
  shortlisted: "Approved",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  management: "Management",
  support: "Support",
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = ["status", "notes", "assigned_to", "ai_score", "proposed_deliverables", "positioning", "negotiation_counter"];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const admin = createAdminClient();

  // Fetch admin's profile for attribution
  const { data: actorProfile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!actorProfile || !["admin", "management", "support"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorName = actorProfile.full_name || user.email || "Admin";
  const actorRole = ROLE_LABELS[actorProfile.role] ?? actorProfile.role;
  const actorDisplay = `${actorName} · ${actorRole}`;

  const { data: before } = await admin
    .from("discovery_profiles")
    .select("*")
    .eq("id", id)
    .single();

  await admin.from("discovery_profiles").update(updates).eq("id", id);

  // Log status changes to the activity thread
  if (updates.status && before && before.status !== updates.status) {
    const newStatus = updates.status as string;
    const fromLabel = STATUS_LABELS[before.status] ?? before.status;
    const toLabel = STATUS_LABELS[newStatus] ?? newStatus;
    await admin.from("discovery_comments").insert({
      discovery_profile_id: id,
      author_id: user.id,
      author_display_name: actorDisplay,
      body: `Status changed from "${fromLabel}" → "${toLabel}"`,
      kind: "status_change",
      visible_to_partner: false,
    });
  }

  // When the admin approves a discovery profile, auto-create an approval packet
  // seeded from the profile so management review can begin.
  if (updates.status === "approved" && before && before.status !== "approved") {
    try {
      const { data: existingDeal } = await admin
        .from("deals")
        .select("id")
        .eq("discovery_profile_id", id)
        .maybeSingle();

      let dealId = existingDeal?.id as string | undefined;
      if (!dealId) {
        const { data: newDeal, error: dealError } = await admin
          .from("deals")
          .insert({
            discovery_profile_id: id,
            status: "pending_approval",
            influencer_name: before.influencer_name,
            influencer_email: before.submitter_email ?? "",
            agency_name: before.agency_name ?? null,
            platform_primary: before.platform_primary ?? "instagram",
            instagram_handle: before.instagram_handle ?? null,
            tiktok_handle: before.tiktok_handle ?? null,
            youtube_handle: before.youtube_handle ?? null,
            follower_count: before.follower_count ?? null,
            niche_tags: before.niche_tags ?? before.niche ?? [],
            deliverables: before.proposed_deliverables ?? [],
            monthly_rate_cents: before.proposed_rate_cents ?? null,
            total_months: before.total_months ?? 3,
            rationale: before.positioning ?? null,
            assigned_to: user.id,
            contract_sequence: 1,
            previous_deal_id: null,
          })
          .select("id")
          .single();

        if (dealError) {
          console.error("[discovery/approve] deal insert failed:", dealError.message);
        } else {
          dealId = newDeal?.id;
        }
      }

      if (dealId) {
        await admin.from("approval_packets").insert({
          created_by: user.id,
          title: `${before.influencer_name} — Contract 1`,
          status: "pending",
          deal_ids: [dealId],
          approver_ids: [],
          required_approvals: 3,
          approved_count: 0,
          rejected_count: 0,
        });

        // Flip discovery to converted to remove it from the Discovery queue
        await admin.from("discovery_profiles").update({ status: "converted" }).eq("id", id);

        await admin.from("discovery_comments").insert({
          discovery_profile_id: id,
          author_id: user.id,
          author_display_name: actorDisplay,
          body: `Approved and moved to the Approvals queue.`,
          kind: "status_change",
          visible_to_partner: false,
        });
      }
    } catch (err) {
      console.error("[discovery/approve] approval packet creation failed:", err);
    }
  }

  await logAuditEvent({
    actorId: user.id,
    entityType: "discovery_profile",
    entityId: id,
    action: updates.status ? `status_changed_to_${updates.status}` : "updated",
    before: before as Record<string, unknown>,
    after: updates as Record<string, unknown>,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: actorProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!actorProfile || !["admin", "management", "support"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("discovery_profiles").delete().eq("id", id);
  if (error) {
    console.error("[discovery/delete]", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
