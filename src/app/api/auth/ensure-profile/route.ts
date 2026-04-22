import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_DOMAINS = ["@prenetics.com", "@im8health.com"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";

  const admin = createAdminClient();
  const isAdmin = ADMIN_DOMAINS.some(d => user.email?.toLowerCase().endsWith(d));
  const role = isAdmin ? "admin" : "influencer";

  const { data: existing } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!existing) {
    const { error: insertError } = await admin.from("profiles").insert({
      id: user.id,
      email: user.email ?? "",
      role,
      full_name: fullName,
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({ role, full_name: fullName });
  }

  const patch: Record<string, string> = {};
  if (isAdmin && existing.role !== "admin") patch.role = "admin";
  if (fullName && !existing.full_name) patch.full_name = fullName;

  if (Object.keys(patch).length > 0) {
    await admin.from("profiles").update(patch).eq("id", user.id);
  }

  return NextResponse.json({
    role: patch.role ?? existing.role,
    full_name: patch.full_name ?? existing.full_name,
  });
}
