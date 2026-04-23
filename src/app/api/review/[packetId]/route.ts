import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ packetId: string }> }
) {
  const { packetId } = await params;
  const { token, reviewerName, body, kind } = await request.json();

  if (!token || !reviewerName?.trim() || !body?.trim() || !kind) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const VALID_KINDS = ["comment", "approval", "rejection", "revision_request"];
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Validate token against the packet — this is the auth for no-login reviewers
  const { data: packet } = await admin
    .from("approval_packets")
    .select("id, title, review_token, status")
    .eq("id", packetId)
    .single();

  if (!packet || packet.review_token !== token) {
    return NextResponse.json({ error: "Invalid or expired review link" }, { status: 403 });
  }

  const { error } = await admin.from("approval_comments").insert({
    packet_id: packetId,
    author_id: null,
    author_display_name: reviewerName.trim(),
    body: body.trim(),
    kind,
  });

  if (error) {
    console.error("[review] Failed to insert comment:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
