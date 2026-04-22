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
  const allowed = ["status", "notes", "assigned_to", "ai_score"];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const admin = createAdminClient();
  const { data: before } = await admin.from("discovery_profiles").select("status").eq("id", id).single();
  await admin.from("discovery_profiles").update(updates).eq("id", id);

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
