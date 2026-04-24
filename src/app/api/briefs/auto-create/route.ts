import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DELIVERABLE_LABELS: Record<string, string> = {
  IGR: "Instagram Reels",
  IGS: "Instagram Stories",
  TIKTOK: "TikTok Videos",
  YT_DEDICATED: "YouTube Dedicated Review",
  YT_INTEGRATED: "YouTube Integrated Review",
  YT_PODCAST: "YouTube Podcast Ad Read",
  UGC: "UGC Videos",
  NEWSLETTER: "Newsletter",
  APP_PARTNERSHIP: "App Partnership",
  BLOG: "Blog Post",
};

/**
 * POST /api/briefs/auto-create
 *
 * Called after "Save contract terms" when deliverables are set.
 * Creates a content brief for the deal if none exists yet.
 * Pre-fills the brief body with the deliverable list so Denis (support)
 * just needs to add the Google Doc link.
 *
 * Returns { created: true } if a new brief was created, { created: false } if one already existed.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { dealId, deliverables } = body as {
    dealId: string;
    deliverables: Array<{ code: string; count: number }>;
  };

  if (!dealId) return NextResponse.json({ error: "dealId required" }, { status: 400 });

  const admin = createAdminClient();

  // Check if a brief already exists for this deal.
  const { count } = await admin
    .from("briefs")
    .select("id", { count: "exact", head: true })
    .eq("deal_id", dealId);

  if ((count ?? 0) > 0) {
    // Brief already exists — no-op.
    return NextResponse.json({ created: false });
  }

  // Fetch deal info for the title.
  const { data: deal } = await admin
    .from("deals")
    .select("influencer_name, platform_primary")
    .eq("id", dealId)
    .single();

  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  // Build a deliverable list as the brief body so Denis can see what to write.
  const deliverableLines = (deliverables ?? [])
    .filter(d => d && d.code && d.count > 0)
    .map(d => `- ${d.count}× ${DELIVERABLE_LABELS[d.code] ?? d.code}`)
    .join("\n");

  const bodyMarkdown = deliverableLines
    ? `Deliverables for this contract:\n${deliverableLines}\n\nAdd the Google Doc brief link above, then click "Send to Influencer".`
    : "";

  const { data: brief, error } = await admin
    .from("briefs")
    .insert({
      deal_id: dealId,
      title: `Content Brief — ${deal.influencer_name}`,
      body_markdown: bodyMarkdown,
      platform: deal.platform_primary,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[briefs/auto-create] insert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ created: true, briefId: brief?.id });
}
