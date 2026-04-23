import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_DOMAINS = ["@prenetics.com", "@im8health.com"];

export async function POST(request: NextRequest) {
  const admin = createAdminClient();

  // Prefer Authorization header — reliable right after signUp before cookies propagate
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  let userId: string;
  let userEmail: string;

  if (token) {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;
    userEmail = user.email ?? "";
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;
    userEmail = user.email ?? "";
  }

  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const partnerType: "creator" | "agency" | null =
    body.partner_type === "agency" ? "agency" :
    body.partner_type === "creator" ? "creator" : null;
  const agencyWebsite = typeof body.agency_website === "string" ? body.agency_website.trim() : null;
  const agencyContactPic = typeof body.agency_contact_pic === "string" ? body.agency_contact_pic.trim() : null;

  const isAdmin = ADMIN_DOMAINS.some(d => userEmail.toLowerCase().endsWith(d));
  const role = isAdmin
    ? "admin"
    : partnerType === "agency"
      ? "agency"
      : "influencer";

  const { data: existing } = await admin
    .from("profiles")
    .select("role, full_name, partner_type")
    .eq("id", userId)
    .single();

  if (!existing) {
    const { error: insertError } = await admin.from("profiles").insert({
      id: userId,
      email: userEmail,
      role,
      full_name: fullName,
      partner_type: partnerType ?? (isAdmin ? null : "creator"),
      agency_website: agencyWebsite,
      agency_contact_pic: agencyContactPic,
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({ role, full_name: fullName, partner_type: partnerType });
  }

  const patch: Record<string, string | null> = {};
  if (isAdmin && existing.role !== "admin") patch.role = "admin";
  if (!isAdmin && partnerType === "agency" && existing.role !== "agency") patch.role = "agency";
  if (fullName && !existing.full_name) patch.full_name = fullName;
  if (partnerType && !existing.partner_type) patch.partner_type = partnerType;
  if (agencyWebsite) patch.agency_website = agencyWebsite;
  if (agencyContactPic) patch.agency_contact_pic = agencyContactPic;

  if (Object.keys(patch).length > 0) {
    await admin.from("profiles").update(patch).eq("id", userId);
  }

  return NextResponse.json({
    role: patch.role ?? existing.role,
    full_name: patch.full_name ?? existing.full_name,
    partner_type: patch.partner_type ?? existing.partner_type,
  });
}
