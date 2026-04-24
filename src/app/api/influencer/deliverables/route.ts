import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealId = request.nextUrl.searchParams.get("dealId");
  if (!dealId) return NextResponse.json({ deliverables: [] });

  const admin = createAdminClient();

  // Verify this deal belongs to the influencer
  const { data: deal } = await admin
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("influencer_profile_id", user.id)
    .single();

  if (!deal) return NextResponse.json({ deliverables: [] });

  const { data } = await admin
    .from("deliverables")
    .select("id, deliverable_type, title, status, sequence")
    .eq("deal_id", dealId)
    .not("status", "in", '("completed")')
    .order("deliverable_type", { ascending: true })
    .order("sequence", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  return NextResponse.json({ deliverables: data ?? [] });
}
