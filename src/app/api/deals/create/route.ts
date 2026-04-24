import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();

  // Auth: admin/management/support only
  const { data: actorProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!actorProfile || !["admin", "management", "support"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin.from("deals").insert({
    influencer_name: body.influencerName,
    influencer_email: body.influencerEmail || "",
    agency_name: body.agencyName || null,
    platform_primary: body.platformPrimary || "instagram",
    instagram_handle: body.igHandle?.trim().replace(/^@/, "") || null,
    tiktok_handle: body.tiktokHandle?.trim().replace(/^@/, "") || null,
    youtube_handle: body.youtubeHandle?.trim().replace(/^@/, "") || null,
    status: body.status ?? "live",
    monthly_rate_cents: body.monthlyRateCents ?? null,
    total_months: body.totalMonths ?? 3,
    follower_count: body.followerCount ?? null,
    niche_tags: Array.isArray(body.nicheTags) ? body.nicheTags : [],
    contract_sequence: 1,
    discovery_profile_id: body.discoveryProfileId || null,
    assigned_to: user.id,
  }).select("id").single();

  if (error) {
    console.error("[deals/create]", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If came from a discovery profile, mark it converted
  if (body.discoveryProfileId) {
    await admin.from("discovery_profiles").update({ status: "converted" }).eq("id", body.discoveryProfileId);
  }

  return NextResponse.json({ id: data.id });
}
