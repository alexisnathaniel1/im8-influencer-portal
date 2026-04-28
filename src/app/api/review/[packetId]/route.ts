import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_KINDS = new Set(["comment", "approval", "rejection", "revision_request"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ packetId: string }> }
) {
  const { packetId } = await params;
  const payload = await request.json();
  const { token, reviewerName } = payload;

  if (!token || !reviewerName?.trim()) {
    return NextResponse.json({ error: "Missing token or reviewer name" }, { status: 400 });
  }

  // Accept either:
  //   • New batch payload: { token, reviewerName, comments: [{ kind, body }, ...] }
  //   • Legacy single-comment payload: { token, reviewerName, kind, body }
  // The new shape lets the public review form post per-creator decisions
  // plus an optional batch-level comment in one round-trip.
  const rawComments: Array<{ kind: string; body: string }> = Array.isArray(payload.comments)
    ? payload.comments
    : (payload.kind && payload.body ? [{ kind: payload.kind, body: payload.body }] : []);

  const cleaned = rawComments
    .map(c => ({ kind: String(c.kind ?? "comment"), body: String(c.body ?? "").trim() }))
    .filter(c => c.body && VALID_KINDS.has(c.kind));

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "No valid decisions or comments to submit" }, { status: 400 });
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

  // Insert all comments in a single batch
  const rows = cleaned.map(c => ({
    packet_id: packetId,
    author_id: null,
    author_display_name: reviewerName.trim(),
    body: c.body,
    kind: c.kind,
  }));

  const { error } = await admin.from("approval_comments").insert(rows);

  if (error) {
    console.error("[review] Failed to insert comments:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
