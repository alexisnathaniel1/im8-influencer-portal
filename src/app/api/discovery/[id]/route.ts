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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = ["status", "notes", "assigned_to", "ai_score", "proposed_deliverables", "positioning", "negotiation_counter"];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("discovery_profiles")
    .select("*")
    .eq("id", id)
    .single();

  await admin.from("discovery_profiles").update(updates).eq("id", id);

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
            deliverables: before.proposed_deliverables ?? [],
            monthly_rate_cents: before.proposed_rate_cents ?? null,
            total_months: 3,
            rationale: before.positioning ?? null,
            assigned_to: user.id,
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
        const { data: profileRow } = await admin
          .from("profiles")
          .select("id, full_name")
          .eq("id", user.id)
          .single();

        await admin.from("approval_packets").insert({
          created_by: user.id,
          title: `${before.influencer_name} — discovery approval`,
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
          author_display_name: profileRow?.full_name ?? "System",
          body: `Approved and moved to Approvals queue.`,
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
