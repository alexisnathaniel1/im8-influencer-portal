import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use admin client to bypass RLS and guarantee schema cache has all deal columns.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("briefs")
    .select("*, deal:deal_id(influencer_name, platform_primary, contract_sequence, total_months, monthly_rate_cents, is_gifted, deliverables)")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

  return NextResponse.json({ brief: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from("briefs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = ["title", "body_markdown", "google_doc_url", "platform", "deliverable_type", "due_date", "status", "sent_at"];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const admin = createAdminClient();
  const { error } = await admin.from("briefs").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: user.id,
    entityType: "brief",
    entityId: id,
    action: updates.status ? `status_changed_to_${updates.status}` : "updated",
    after: updates as Record<string, unknown>,
  });

  return NextResponse.json({ success: true });
}
