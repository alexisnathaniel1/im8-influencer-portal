import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit/log";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = [
    "influencer_name", "influencer_email", "agency_name", "platform_primary",
    "deliverables", "monthly_rate_cents", "total_months", "campaign_start",
    "campaign_end", "rationale", "outreach_thread_url", "status", "rejection_reason",
    "instagram_handle", "tiktok_handle", "youtube_handle",
    "is_gifted", "gifted_product", "gifted_quantity", "product_sent_at", "needs_approval",
    "niche_tags", "follower_count",
    "campaign_start", "campaign_end", "contract_signed_at", "contract_url",
    "payment_terms", "contract_requirements", "exclusivity_clause", "usage_rights_months",
  ];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const admin = createAdminClient();

  // Read current status before update so we can detect contracted transition
  const { data: before } = await admin.from("deals").select("status, deliverables, influencer_name, platform_primary").eq("id", id).single();

  const { error } = await admin.from("deals").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auto-populate deliverables when a deal moves to contracted for the first time
  if (updates.status === "contracted" && before?.status !== "contracted") {
    const deliverableItems = (before?.deliverables ?? updates.deliverables ?? []) as Array<{ code: string; count: number }>;
    if (deliverableItems.length > 0) {
      // Check if deliverables already exist for this deal
      const { count } = await admin.from("deliverables").select("*", { count: "exact", head: true }).eq("deal_id", id);
      if ((count ?? 0) === 0) {
        const PLATFORM_MAP: Record<string, string> = {
          IGR: "instagram", IGS: "instagram", WHITELIST: "instagram",
          TIKTOK_VIDEO: "tiktok", UGC: "other",
        };
        const rows = deliverableItems.flatMap(item =>
          Array.from({ length: item.count }, () => ({
            deal_id: id,
            deliverable_type: item.code,
            platform: PLATFORM_MAP[item.code] ?? (before?.platform_primary ?? "instagram"),
            is_story: item.code === "IGS",
            title: `${before?.influencer_name ?? ""} — ${item.code}`,
          }))
        );
        await admin.from("deliverables").insert(rows);
      }
    }
  }

  await logAuditEvent({
    actorId: user.id,
    entityType: "deal",
    entityId: id,
    action: updates.status ? `status_changed_to_${updates.status}` : "updated",
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
  if (!actorProfile || !["admin", "management"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("deals").delete().eq("id", id);
  if (error) {
    console.error("[deals/delete]", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
