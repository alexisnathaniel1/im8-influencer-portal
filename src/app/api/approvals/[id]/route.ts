import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Delete the packet — cascades to approval_decisions and approval_comments via FK
  const { error } = await admin.from("approval_packets").delete().eq("id", id);
  if (error) {
    console.error("[approvals/delete]", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
