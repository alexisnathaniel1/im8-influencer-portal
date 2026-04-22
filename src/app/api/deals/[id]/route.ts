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
    "campaign_start", "campaign_end", "contract_signed_at", "contract_url",
    "payment_terms", "contract_requirements", "exclusivity_clause", "usage_rights_months",
  ];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const admin = createAdminClient();
  const { error } = await admin.from("deals").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: user.id,
    entityType: "deal",
    entityId: id,
    action: updates.status ? `status_changed_to_${updates.status}` : "updated",
    after: updates as Record<string, unknown>,
  });

  return NextResponse.json({ success: true });
}
