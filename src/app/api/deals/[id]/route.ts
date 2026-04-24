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
    "contract_url", "payment_terms", "contract_requirements", "usage_rights_months",
    "discount_code", "affiliate_link",
  ];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const admin = createAdminClient();

  // Read current status before update so we can detect contracted transition
  const { data: before } = await admin.from("deals").select("status, deliverables, influencer_name, platform_primary").eq("id", id).single();

  const { error } = await admin.from("deals").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auto-populate deliverables as soon as a deal is approved/contracted/live AND
  // deliverables have been saved. No manual "Move to contracted" click required —
  // the tracker mirrors the contract state automatically.
  // WHITELIST is a rights grant, not a schedulable post, so we skip it here.
  {
    const effectiveStatus = (updates.status as string | undefined) ?? before?.status ?? "";
    const effectiveDeliverables =
      ((updates.deliverables as Array<{ code: string; count: number }> | undefined) ??
       (before?.deliverables as Array<{ code: string; count: number }> | undefined) ?? [])
        // Exclude rights/extras — not schedulable content deliverables
        .filter(item => item && item.code && item.count > 0
          && !["WHITELIST", "PAID_AD", "RAW_FOOTAGE", "LINK_BIO"].includes(item.code));

    const statusReady = ["approved", "contracted", "live"].includes(effectiveStatus);

    if (statusReady && effectiveDeliverables.length > 0) {
      const { count } = await admin.from("deliverables")
        .select("*", { count: "exact", head: true }).eq("deal_id", id);
      if ((count ?? 0) === 0) {
        const PLATFORM_MAP: Record<string, string> = {
          IGR: "instagram", IGS: "instagram",
          TIKTOK: "tiktok",
          YT_DEDICATED: "youtube", YT_INTEGRATED: "youtube", YT_PODCAST: "youtube",
          UGC: "other",
          NEWSLETTER: "other", APP_PARTNERSHIP: "other", BLOG: "other",
        };
        const rows = effectiveDeliverables.flatMap(item =>
          Array.from({ length: item.count }, (_, i) => ({
            deal_id: id,
            deliverable_type: item.code,
            platform: PLATFORM_MAP[item.code] ?? (before?.platform_primary ?? "instagram"),
            is_story: item.code === "IGS",
            // Per-type sequence (1, 2, 3…) so 3× IGR shows as IGR #1, #2, #3.
            sequence: i + 1,
            title: `${before?.influencer_name ?? ""} — ${item.code} #${i + 1}`,
          }))
        );
        if (rows.length > 0) await admin.from("deliverables").insert(rows);
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
