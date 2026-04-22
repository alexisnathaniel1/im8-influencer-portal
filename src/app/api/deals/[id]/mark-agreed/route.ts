import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit/log";
import { syncInfluencerToTracker } from "@/lib/google/sheets";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: deal } = await admin.from("deals").select("*").eq("id", id).single();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  // Validate required fields (relaxed for gifted deals — no rate needed)
  const missing: string[] = [];
  if (!deal.is_gifted && !deal.monthly_rate_cents) missing.push("monthly rate");
  if (!deal.is_gifted && !deal.total_months) missing.push("total months");
  if (deal.is_gifted && !deal.gifted_product) missing.push("gifted product");
  if (!deal.rationale?.trim()) missing.push("rationale");

  if (missing.length) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 422 });
  }

  await admin.from("deals").update({ status: "agreed" }).eq("id", id);

  await logAuditEvent({
    actorId: user.id,
    entityType: "deal",
    entityId: id,
    action: "status_changed_to_agreed",
    before: { status: deal.status },
    after: { status: "agreed" },
  });

  // Sync to Google Sheets in background
  try {
    await syncInfluencerToTracker({
      fullName: deal.influencer_name,
      email: deal.influencer_email,
      agencyName: deal.agency_name,
      primaryPlatform: deal.platform_primary,
      status: "agreed",
      monthlyRateCents: deal.monthly_rate_cents,
      totalRateCents: deal.total_rate_cents,
    });
  } catch (err) {
    console.error("[mark-agreed] Sheets sync failed:", err);
  }

  return NextResponse.json({ success: true });
}
