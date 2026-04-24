import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit/log";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { approverId, decisions } = await request.json();

  if (!approverId || !decisions) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  const admin = createAdminClient();
  const { data: packet } = await admin.from("approval_packets").select("*").eq("id", id).single();
  if (!packet) return NextResponse.json({ error: "Packet not found" }, { status: 404 });

  // Upsert decisions
  const rows = Object.entries(decisions as Record<string, { decision: string; comment: string }>).map(([dealId, d]) => ({
    packet_id: id,
    deal_id: dealId,
    approver_id: approverId,
    decision: d.decision,
    comment: d.comment || null,
    decided_at: new Date().toISOString(),
  }));

  await admin.from("approval_decisions").upsert(rows, { onConflict: "packet_id,deal_id,approver_id" });

  // Recalculate packet status
  const { data: allDecisions } = await admin.from("approval_decisions").select("*").eq("packet_id", id);
  const approverIds: string[] = packet.approver_ids ?? [];
  // required = number of distinct approvers who must approve (at least 1)
  const required = Math.max(approverIds.length, 1);
  const dealIds: string[] = packet.deal_ids ?? [];

  // Per-deal: deal is approved if all required approvers have approved it
  const dealApproved: Record<string, boolean> = {};
  for (const dealId of dealIds) {
    const dealDecs = (allDecisions ?? []).filter(d => d.deal_id === dealId);
    const distinctApprovedIds = new Set(
      dealDecs.filter(d => d.decision === "approved").map(d => d.approver_id)
    );
    dealApproved[dealId] = distinctApprovedIds.size >= required;
  }

  // Transition individual deals
  const approvedDealIds = dealIds.filter(id => dealApproved[id]);
  const rejectedDealIds = dealIds.filter(id => {
    const dealDecs = (allDecisions ?? []).filter(d => d.deal_id === id);
    return dealDecs.some(d => d.decision === "rejected");
  });

  if (approvedDealIds.length > 0) {
    await admin.from("deals").update({ status: "approved" }).in("id", approvedDealIds);
  }
  if (rejectedDealIds.length > 0) {
    await admin.from("deals").update({ status: "rejected" }).in("id", rejectedDealIds);
  }

  // Update packet status
  const totalApproved = approvedDealIds.length;
  const totalRejected = rejectedDealIds.length;
  let packetStatus = "pending";
  if (totalApproved + totalRejected === dealIds.length) {
    packetStatus = totalRejected === 0 ? "approved" : totalApproved === 0 ? "rejected" : "partially_approved";
  } else if (totalApproved > 0) {
    packetStatus = "partially_approved";
  }

  await admin.from("approval_packets").update({
    status: packetStatus,
    approved_count: totalApproved,
    rejected_count: totalRejected,
  }).eq("id", id);

  await logAuditEvent({
    actorId: approverId,
    entityType: "approval_packet",
    entityId: id,
    action: "decisions_submitted",
    after: { decisions, packetStatus } as Record<string, unknown>,
  });

  return NextResponse.json({ success: true, packetStatus });
}
