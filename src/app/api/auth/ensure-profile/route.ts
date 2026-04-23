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

  const isStaffDomain = ADMIN_DOMAINS.some(d => userEmail.toLowerCase().endsWith(d));
  // New staff-domain accounts start as 'pending' — an admin must activate them.
  // This prevents new hires / editors from immediately getting admin access.
  const role = isStaffDomain
    ? "pending"
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
      partner_type: partnerType ?? (isStaffDomain ? null : "creator"),
      agency_website: agencyWebsite,
      agency_contact_pic: agencyContactPic,
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    // Link any existing discovery submissions that were filed against this email.
    // Covers the case where an admin manually added the creator to Discovery
    // before they had a portal account — on signup, their submissions auto-appear
    // in /partner and they get full dashboard access without re-filling intake.
    if (!isStaffDomain && userEmail) {
      await linkOrphanDiscoveryProfilesToUser(admin, userEmail, userId);
    }

    return NextResponse.json({ role, full_name: fullName, partner_type: partnerType });
  }

  const patch: Record<string, string | null> = {};
  // Promote partner-role accounts on staff domains to pending (for admin to activate).
  // Never downgrade an already-elevated staff role.
  const PARTNER_ROLES = ["influencer", "agency"];
  if (isStaffDomain && PARTNER_ROLES.includes(existing.role)) patch.role = "pending";
  if (!isStaffDomain && partnerType === "agency" && existing.role !== "agency") patch.role = "agency";
  if (fullName && !existing.full_name) patch.full_name = fullName;
  if (partnerType && !existing.partner_type) patch.partner_type = partnerType;
  if (agencyWebsite) patch.agency_website = agencyWebsite;
  if (agencyContactPic) patch.agency_contact_pic = agencyContactPic;

  if (Object.keys(patch).length > 0) {
    await admin.from("profiles").update(patch).eq("id", userId);
  }

  // Also link any orphan discovery submissions on login for existing accounts
  // (catches the case where a profile exists but was created before Discovery entries).
  if (!isStaffDomain && userEmail) {
    await linkOrphanDiscoveryProfilesToUser(admin, userEmail, userId);
  }

  return NextResponse.json({
    role: patch.role ?? existing.role,
    full_name: patch.full_name ?? existing.full_name,
    partner_type: patch.partner_type ?? existing.partner_type,
  });
}

// Link any discovery_profiles rows submitted against this email to the
// signed-in user, so their manually-added submissions appear on /partner.
// Only claims rows whose submitted_by_profile_id isn't already a non-staff
// owner (admin-authored rows are fine to reassign; another creator's rows are not).
async function linkOrphanDiscoveryProfilesToUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  userId: string,
) {
  try {
    const { data: rows } = await admin
      .from("discovery_profiles")
      .select("id, submitted_by_profile_id")
      .ilike("submitter_email", email);

    if (!rows || rows.length === 0) return;

    const orphanIds = rows
      .filter(r => r.submitted_by_profile_id !== userId)
      .map(r => r.id);

    if (orphanIds.length > 0) {
      await admin
        .from("discovery_profiles")
        .update({ submitted_by_profile_id: userId })
        .in("id", orphanIds);
    }
  } catch (err) {
    console.error("[ensure-profile] Failed to link discovery profiles:", err);
    // Non-fatal — signup still succeeds
  }
}
