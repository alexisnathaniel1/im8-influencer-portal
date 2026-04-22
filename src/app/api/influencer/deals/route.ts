import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: deals } = await supabase
    .from("deals")
    .select("id, influencer_name, platform_primary, status")
    .eq("influencer_profile_id", user.id)
    .in("status", ["contracted", "live", "approved"]);

  return NextResponse.json({ deals: deals ?? [] });
}
