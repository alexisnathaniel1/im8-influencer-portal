import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftBrief } from "@/lib/ai/brief-draft";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: brief } = await admin
    .from("briefs")
    .select("*, deal:deal_id(*)")
    .eq("id", id)
    .single();

  if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

  const deal = brief.deal as Record<string, unknown>;

  const markdown = await draftBrief({
    influencerName: deal.influencer_name as string,
    platform: (brief.platform || deal.platform_primary) as string,
    deliverableType: brief.deliverable_type as string | undefined,
    monthlyRateCents: deal.monthly_rate_cents as number | undefined,
    totalMonths: deal.total_months as number | undefined,
    rationale: deal.rationale as string | undefined,
    deliverables: deal.deliverables as unknown[],
    campaignStart: deal.campaign_start as string | undefined,
    campaignEnd: deal.campaign_end as string | undefined,
  });

  if (!markdown) {
    return NextResponse.json({ error: "Gemini returned no content — check GEMINI_API_KEY and server logs" }, { status: 500 });
  }

  await admin.from("briefs").update({ body_markdown: markdown }).eq("id", id);
  return NextResponse.json({ markdown });
}
