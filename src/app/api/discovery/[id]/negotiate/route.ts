import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { response } = await req.json(); // 'accepted' | 'declined'
  if (!["accepted", "declined"].includes(response)) {
    return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("discovery_profiles")
    .update({
      agency_response: response,
      agency_responded_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Log a partner-visible comment recording the response
  const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
  await admin.from("discovery_comments").insert({
    discovery_profile_id: id,
    author_id: user.id,
    author_display_name: profile?.full_name ?? profile?.email ?? "Agency",
    body: response === "accepted" ? "Agency accepted the counter-proposal." : "Agency declined the counter-proposal.",
    visible_to_partner: true,
    kind: "agency_response",
  });

  return NextResponse.json({ ok: true });
}
