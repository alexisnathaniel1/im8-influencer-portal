import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PLATFORM_MAP: Record<string, string> = {
  IGR: "instagram", IGS: "instagram",
  TIKTOK: "tiktok",
  YT_DEDICATED: "youtube", YT_INTEGRATED: "youtube", YT_PODCAST: "youtube",
  UGC: "other",
  NEWSLETTER: "other", APP_PARTNERSHIP: "other", BLOG: "other",
};

/**
 * POST /api/deals/[id]/deliverable-brief
 * Body: { code: string; sequence: number; brief_doc_url: string | null }
 *
 * Ensures a tracker row exists for this deal/code/sequence (creates it if absent),
 * then saves the brief_doc_url. Returns the row id so the client can use it for
 * subsequent PATCH calls.
 *
 * Resilient to the `sequence` column being absent from the schema cache —
 * falls back to title-based lookup and omits sequence from the insert if the
 * column doesn't exist yet (migration 039 pending).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Role check — admin, management, support only
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "management", "support"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const code: string = body.code;
  const sequence: number = parseInt(body.sequence ?? "1", 10);
  const briefDocUrl: string | null = body.brief_doc_url ?? null;

  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  // Load the deal for context (influencer name, platform)
  const { data: deal } = await admin.from("deals")
    .select("influencer_name, platform_primary")
    .eq("id", id).single();

  const expectedTitle = `${deal?.influencer_name ?? ""} — ${code} #${sequence}`;

  // Try to find existing tracker row by sequence (preferred), falling back to title
  let rowId: string | null = null;

  // Attempt 1: filter by sequence column (requires migration 039)
  const { data: bySeq, error: seqErr } = await admin.from("deliverables")
    .select("id")
    .eq("deal_id", id)
    .eq("deliverable_type", code)
    .eq("sequence", sequence)
    .maybeSingle();

  if (!seqErr && bySeq) {
    rowId = bySeq.id;
  } else if (seqErr) {
    // sequence column may not exist yet — fall back to title match
    console.warn("[deliverable-brief] sequence column unavailable, falling back to title lookup:", seqErr.message);
    const { data: byTitle } = await admin.from("deliverables")
      .select("id")
      .eq("deal_id", id)
      .eq("deliverable_type", code)
      .eq("title", expectedTitle)
      .maybeSingle();
    if (byTitle) rowId = byTitle.id;
  }

  if (!rowId) {
    // Create the tracker row on-demand.
    // Try with sequence first; if that fails (column absent), insert without it.
    const baseRow = {
      deal_id: id,
      deliverable_type: code,
      platform: PLATFORM_MAP[code] ?? (deal?.platform_primary ?? "instagram"),
      is_story: code === "IGS",
      title: expectedTitle,
    };

    const { data: inserted, error: insertErr } = await admin.from("deliverables")
      .insert({ ...baseRow, sequence })
      .select("id").single();

    if (insertErr) {
      if (insertErr.message.includes("sequence")) {
        // Column doesn't exist yet — insert without it
        console.warn("[deliverable-brief] inserting without sequence column:", insertErr.message);
        const { data: inserted2, error: insertErr2 } = await admin.from("deliverables")
          .insert(baseRow)
          .select("id").single();
        if (insertErr2 || !inserted2) {
          console.error("[deliverable-brief] create row failed:", insertErr2?.message);
          return NextResponse.json({ error: insertErr2?.message ?? "Could not create tracker row" }, { status: 500 });
        }
        rowId = inserted2.id;
      } else {
        console.error("[deliverable-brief] create row failed:", insertErr.message);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    } else {
      rowId = inserted!.id;
    }
  }

  // Save the brief_doc_url
  const { error: patchErr } = await admin.from("deliverables")
    .update({ brief_doc_url: briefDocUrl })
    .eq("id", rowId);

  if (patchErr) {
    return NextResponse.json({ error: patchErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: rowId });
}
