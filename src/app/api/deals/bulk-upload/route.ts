import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerPayload } from "@/lib/csv/partners-template";
import { DELIVERABLE_PLATFORM_MAP, BINARY_DELIVERABLE_CODES } from "@/lib/deliverables";

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

  // Pre-load existing (name, email) pairs so we skip true duplicates without
  // blocking legitimate agency-managed creators who share a contact email.
  // E.g. Stuart Duguid manages Aryna Sabalenka AND Eva Lys with the same email
  // — those are different creators, not duplicates.
  const incomingEmails = body.rows.map(r => r.influencer_email.toLowerCase());
  const { data: existing } = await admin
    .from("deals")
    .select("influencer_name, influencer_email")
    .in("influencer_email", incomingEmails);
  const dedupKey = (name: string, email: string) =>
    `${name.trim().toLowerCase()}|${email.trim().toLowerCase()}`;
  const existingSet = new Set(
    (existing ?? [])
      .map(e => {
        const name = (e.influencer_name as string | null) ?? "";
        const email = (e.influencer_email as string | null) ?? "";
        return name && email ? dedupKey(name, email) : null;
      })
      .filter(Boolean) as string[]
  );

  const inserts: Record<string, unknown>[] = [];
  const skipped: { email: string; reason: string }[] = [];
  // Keep the original row alongside the insert payload so we can use the
  // completed_deliverables list once we know the new deal IDs.
  // Keyed on (name, email) since multiple creators can share an agency email.
  const rowByKey = new Map<string, PartnerPayload>();

  for (const r of body.rows) {
    const key = dedupKey(r.influencer_name, r.influencer_email);
    if (existingSet.has(key)) {
      skipped.push({ email: r.influencer_email.toLowerCase(), reason: `${r.influencer_name} already exists` });
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
      contract_url: r.contract_url,
      contact_phone: r.phone,
      manager_email: r.manager_email,
      rationale: r.rationale,
      contract_sequence: 1,
      assigned_to: user.id,
    });
    rowByKey.set(key, r);
    existingSet.add(key); // dedupe within the same upload
  }

  if (inserts.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped });
  }

  const { data, error } = await admin
    .from("deals")
    .insert(inserts)
    .select("id, influencer_name, influencer_email, platform_primary");
  if (error) {
    console.error("[deals/bulk-upload]", error.message);
    return NextResponse.json({ error: error.message, inserted: 0, skipped }, { status: 500 });
  }

  // For each newly-inserted deal: build its tracker rows from the deliverables
  // list, then flip the first N of each completed type to status='live' so
  // mid-contract partners come in with the right progress on day one.
  // PLATFORM_MAP + RIGHTS_CODES sourced from canonical registry so adding a
  // new deliverable code only requires editing @/lib/deliverables.

  let deliverablesCreated = 0;
  let markedLive = 0;

  for (const deal of data ?? []) {
    const name = (deal.influencer_name as string | null) ?? "";
    const email = (deal.influencer_email as string | null) ?? "";
    const r = rowByKey.get(dedupKey(name, email));
    if (!r) continue;

    const platformPrimary = (deal.platform_primary as string | null) ?? "instagram";
    const contentItems = r.deliverables.filter(
      (item) => item && item.code && item.count > 0 && !BINARY_DELIVERABLE_CODES.has(item.code)
    );
    if (contentItems.length === 0) continue;

    // Build pending tracker rows
    const rows = contentItems.flatMap((item) =>
      Array.from({ length: item.count }, (_, i) => {
        const seq = i + 1;
        const completed =
          (r.completed_deliverables.find((c) => c.code === item.code)?.count ?? 0) >= seq;
        return {
          deal_id: deal.id as string,
          deliverable_type: item.code,
          platform: DELIVERABLE_PLATFORM_MAP[item.code] ?? platformPrimary,
          is_story: item.code === "IGS",
          sequence: seq,
          title: `${(deal.influencer_name as string) ?? ""} — ${item.code} #${seq}`,
          status: completed ? "live" : "pending",
          live_date: completed ? new Date().toISOString().split("T")[0] : null,
        };
      })
    );

    if (rows.length === 0) continue;

    const { error: insertErr } = await admin.from("deliverables").insert(rows);
    if (insertErr) {
      // Retry without `sequence` if column not migrated yet
      if (insertErr.message.includes("sequence")) {
        const noSeq = rows.map(({ sequence: _seq, ...rest }) => rest);
        const { error: retryErr } = await admin.from("deliverables").insert(noSeq);
        if (retryErr) {
          console.error("[bulk-upload] deliverables insert (no seq) failed:", retryErr.message);
          continue;
        }
      } else {
        console.error("[bulk-upload] deliverables insert failed:", insertErr.message);
        continue;
      }
    }
    deliverablesCreated += rows.length;
    markedLive += rows.filter((r) => r.status === "live").length;
  }

  return NextResponse.json({
    ok: true,
    inserted: data?.length ?? 0,
    deliverablesCreated,
    markedLive,
    skipped,
  });
}
