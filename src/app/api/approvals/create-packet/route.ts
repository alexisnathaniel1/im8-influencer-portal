import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, dealIds, approverIds } = await request.json();

  if (!title || !dealIds?.length || !approverIds?.length) {
    return NextResponse.json({ error: "Missing title, deals, or approvers" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create the packet
  const { data: packet, error } = await admin.from("approval_packets").insert({
    created_by: user.id,
    title,
    deal_ids: dealIds,
    approver_ids: approverIds,
    required_approvals: approverIds.length,
    status: "pending",
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Transition deals to pending_approval
  await admin.from("deals").update({ status: "pending_approval" }).in("id", dealIds);

  // Email approvers
  try {
    const { data: approvers } = await admin.from("profiles").select("email, full_name").in("id", approverIds);
    const { data: deals } = await admin.from("deals").select("influencer_name, monthly_rate_cents, total_months, total_rate_cents").in("id", dealIds);

    const dealList = (deals ?? []).map(d =>
      `• ${d.influencer_name} — $${d.monthly_rate_cents ? (d.monthly_rate_cents / 100).toFixed(0) : "??"}/mo × ${d.total_months}mo = $${d.total_rate_cents ? (d.total_rate_cents / 100).toFixed(0) : "??"}`
    ).join("\n");

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const transporter = createTransporter();

    await Promise.all((approvers ?? []).map(approver =>
      transporter.sendMail({
        from: EMAIL_FROM,
        to: approver.email,
        subject: `[IM8] Approval needed: ${title}`,
        text: `Hi ${approver.full_name},\n\nYou have a new influencer partnership batch ready for your review.\n\nPacket: ${title}\nInfluencers (${dealIds.length}):\n${dealList}\n\nReview and approve here:\n${portalUrl}/approver/packets/${packet.id}\n\nThank you,\nIM8 Influencer Team`,
        html: `<p>Hi ${approver.full_name},</p><p>You have a new influencer partnership batch ready for your review.</p><p><strong>${title}</strong> — ${dealIds.length} influencer${dealIds.length > 1 ? "s" : ""}:</p><pre style="background:#f5f5f5;padding:12px;border-radius:6px">${dealList}</pre><p><a href="${portalUrl}/approver/packets/${packet.id}" style="background:#A40011;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Review & Approve →</a></p>`,
      })
    ));
  } catch (err) {
    console.error("[create-packet] Email send failed:", err);
  }

  return NextResponse.json({ id: packet.id });
}
