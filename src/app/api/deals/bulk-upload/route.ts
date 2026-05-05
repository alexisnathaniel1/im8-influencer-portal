import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerPayload } from "@/lib/csv/partners-template";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: actorProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!actorProfile || !["admin", "management", "support"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as { rows: PartnerPayload[] };
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  // Pre-load existing emails so we skip duplicates instead of erroring
  const incomingEmails = body.rows.map(r => r.influencer_email.toLowerCase());
  const { data: existing } = await admin
    .from("deals")
    .select("influencer_email")
    .in("influencer_email", incomingEmails);
  const existingSet = new Set(
    (existing ?? [])
      .map(e => (e.influencer_email as string | null)?.toLowerCase())
      .filter(Boolean) as string[]
  );

  const inserts: Record<string, unknown>[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const r of body.rows) {
    const email = r.influencer_email.toLowerCase();
    if (existingSet.has(email)) {
      skipped.push({ email, reason: "Already exists" });
      continue;
    }
    inserts.push({
      influencer_name: r.influencer_name,
      influencer_email: r.influencer_email,
      agency_name: r.agency_name,
      platform_primary: r.platform_primary,
      instagram_handle: r.instagram_handle,
      tiktok_handle: r.tiktok_handle,
      youtube_handle: r.youtube_handle,
      follower_count: r.follower_count,
      niche_tags: r.niche_tags,
      monthly_rate_cents: r.monthly_rate_cents,
      total_months: r.total_months,
      currency_code: r.currency_code,
      campaign_start: r.campaign_start,
      campaign_end: r.campaign_end,
      status: r.status,
      deliverables: r.deliverables,
      discount_code: r.discount_code,
      affiliate_link: r.affiliate_link,
      contact_phone: r.phone,
      manager_email: r.manager_email,
      rationale: r.rationale,
      contract_sequence: 1,
      assigned_to: user.id,
    });
    existingSet.add(email); // dedupe within the same upload
  }

  if (inserts.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped });
  }

  const { data, error } = await admin.from("deals").insert(inserts).select("id, influencer_name");
  if (error) {
    console.error("[deals/bulk-upload]", error.message);
    return NextResponse.json({ error: error.message, inserted: 0, skipped }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    inserted: data?.length ?? 0,
    skipped,
  });
}
