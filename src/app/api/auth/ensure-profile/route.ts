import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_DOMAINS = ["@prenetics.com", "@im8health.com"];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const isAdmin = ADMIN_DOMAINS.some(d => user.email?.toLowerCase().endsWith(d));
  const role = isAdmin ? "admin" : "influencer";

  const { data: existing } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!existing) {
    await admin.from("profiles").insert({
      id: user.id,
      email: user.email ?? "",
      role,
    });
    return NextResponse.json({ role });
  }

  // Correct the role if email domain changed or trigger assigned wrong role
  if (isAdmin && existing.role !== "admin") {
    await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
    return NextResponse.json({ role: "admin" });
  }

  return NextResponse.json({ role: existing.role });
}
