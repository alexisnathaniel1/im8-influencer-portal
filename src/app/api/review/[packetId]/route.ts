import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_KINDS = new Set(["comment", "approval", "rejection", "revision_request"]);

type IncomingComment = { kind: string; body: string; dealId?: string };

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
  //   • New batch payload: { token, reviewerName, comments: [{ kind, body, dealId? }, ...] }
  //   • Legacy single-comment payload: { token, reviewerName, kind, body }
  // Per-deal decisions carry dealId so we can directly flip the deal's
  // status and propagate to the linked discovery_profile row.
  const rawComments: IncomingComment[] = Array.isArray(payload.comments)
    ? payload.comments
    : (payload.kind && payload.body ? [{ kind: payload.kind, body: payload.body }] : []);

  const cleaned = rawComments
    .map(c => ({
      kind: String(c.kind ?? "comment"),
      body: String(c.body ?? "").trim(),
      dealId: typeof c.dealId === "string" ? c.dealId : undefined,
    }))
    .filter(c => c.body && VALID_KINDS.has(c.kind));

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "No valid decisions or comments to submit" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Validate token against the packet — this is the auth for no-login reviewers
  const { data: packet } = await admin
    .from("approval_packets")
    .select("id, title, review_token, status, deal_ids")
    .eq("id", packetId)
    .single();

  if (!packet || packet.review_token !== token) {
    return NextResponse.json({ error: "Invalid or expired review link" }, { status: 403 });
  }

  // Insert all comments into the activity feed (admin side panel reads these).
  const commentRows = cleaned.map(c => ({
    packet_id: packetId,
    author_id: null,
    author_display_name: reviewerName.trim(),
    body: c.body,
    kind: c.kind,
  }));
  const { error: commentsError } = await admin.from("approval_comments").insert(commentRows);
  if (commentsError) {
    console.error("[review] Failed to insert comments:", commentsError.message);
    return NextResponse.json({ error: commentsError.message }, { status: 500 });
  }

  // Apply per-deal decisions: any cleaned entry with a dealId AND
  // kind === 'approval' or 'rejection' becomes a real status change on
  // the deal AND on its linked discovery_profile (so the partner sees
  // 'Approved' / 'Rejected' on their dashboard).
  const validDealIds = new Set((packet.deal_ids ?? []) as string[]);
  const approveDealIds: string[] = [];
  const rejectDealIds: string[] = [];
  for (const c of cleaned) {
    if (!c.dealId || !validDealIds.has(c.dealId)) continue;
    if (c.kind === "approval") approveDealIds.push(c.dealId);
    else if (c.kind === "rejection") rejectDealIds.push(c.dealId);
  }

  if (approveDealIds.length > 0) {
    await admin.from("deals").update({ status: "approved" }).in("id", approveDealIds);
    // Propagate to linked discovery profiles so /partner reflects the outcome
    const { data: approvedDeals } = await admin
      .from("deals").select("discovery_profile_id").in("id", approveDealIds);
    const discIds = (approvedDeals ?? []).map(d => d.discovery_profile_id).filter((x): x is string => !!x);
    if (discIds.length > 0) {
      await admin.from("discovery_profiles").update({ status: "approved" }).in("id", discIds);
    }
  }

  if (rejectDealIds.length > 0) {
    await admin.from("deals").update({ status: "rejected" }).in("id", rejectDealIds);
    const { data: rejectedDeals } = await admin
      .from("deals").select("discovery_profile_id").in("id", rejectDealIds);
    const discIds = (rejectedDeals ?? []).map(d => d.discovery_profile_id).filter((x): x is string => !!x);
    if (discIds.length > 0) {
      await admin.from("discovery_profiles").update({ status: "rejected" }).in("id", discIds);
    }
  }

  // Recalculate packet status + counts from the deals' current statuses
  // so the admin Approvals page always reflects the latest state.
  if (approveDealIds.length > 0 || rejectDealIds.length > 0) {
    const allIds = (packet.deal_ids ?? []) as string[];
    const { data: dealsNow } = await admin
      .from("deals").select("id, status").in("id", allIds);
    const statusByDeal: Record<string, string> = {};
    for (const d of dealsNow ?? []) statusByDeal[d.id as string] = d.status as string;
    const approvedCount = allIds.filter(id => statusByDeal[id] === "approved").length;
    const rejectedCount = allIds.filter(id => statusByDeal[id] === "rejected").length;
    const decided = approvedCount + rejectedCount;
    let nextStatus: string;
    if (decided === 0) nextStatus = "pending";
    else if (decided < allIds.length) nextStatus = "partially_approved";
    else if (rejectedCount === 0) nextStatus = "approved";
    else if (approvedCount === 0) nextStatus = "rejected";
    else nextStatus = "partially_approved";

    await admin.from("approval_packets").update({
      status: nextStatus,
      approved_count: approvedCount,
      rejected_count: rejectedCount,
    }).eq("id", packetId);
  }

  return NextResponse.json({
    ok: true,
    count: commentRows.length,
    approvedDeals: approveDealIds.length,
    rejectedDeals: rejectDealIds.length,
  });
}
