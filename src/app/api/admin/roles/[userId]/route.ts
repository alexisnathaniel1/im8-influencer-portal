import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = ["owner", "admin", "ops", "management", "influencer_team", "finance", "approver", "editor", "influencer", "agency"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden — only Owner or Admin can change roles" }, { status: 403 });
  }

  const { userId } = await params;
  const { role } = await request.json();

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent demoting the last owner
  if (profile.role === "owner" || role !== "owner") {
    const admin = createAdminClient();

    if (role !== "owner") {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "owner");
      const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
      if (target?.role === "owner" && (count ?? 0) <= 1) {
        return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 });
      }
    }

    const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
    if (error) {
      console.error("[admin/roles] Failed to update role:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
