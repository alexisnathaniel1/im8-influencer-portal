import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await request.json();
  if (!dealId) return NextResponse.json({ error: "dealId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: deal } = await admin.from("deals").select("influencer_name, platform_primary").eq("id", dealId).single();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const { data: brief, error } = await admin
    .from("briefs")
    .insert({
      deal_id: dealId,
      title: `Brief for ${deal.influencer_name}`,
      body_markdown: "",
      platform: deal.platform_primary,
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ brief });
}
