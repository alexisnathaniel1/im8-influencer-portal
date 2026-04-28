import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter } from "@/lib/email/client";
import { approvalRequestTemplate } from "@/lib/email/templates/approval-request";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, dealIds, approverIds, batchNote } = await request.json();

  if (!title || !dealIds?.length || !approverIds?.length) {
    return NextResponse.json({ error: "Missing title, deals, or approvers" }, { status: 400 });
  }

  const admin = createAdminClient();
  const reviewToken = randomUUID();

  const { data: packet, error } = await admin.from("approval_packets").insert({
    created_by: user.id,
    title,
    deal_ids: dealIds,
    approver_ids: approverIds,
    required_approvals: approverIds.length,
    status: "pending",
    review_token: reviewToken,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("deals").update({ status: "pending_approval" }).in("id", dealIds);

  // Save the batch-level note (if any) as a packet comment so it shows in
  // the side panel thread. Only insert when non-empty so we don't litter
  // the thread with blank rows.
  const trimmedNote = typeof batchNote === "string" ? batchNote.trim() : "";
  if (trimmedNote) {
    const { data: actorProfile } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
    await admin.from("approval_comments").insert({
      packet_id: packet.id,
      author_id: user.id,
      author_display_name: actorProfile?.full_name ?? "Admin",
      body: trimmedNote,
      kind: "comment",
    });
  }

  try {
    const { data: approvers } = await admin.from("profiles").select("email, full_name").in("id", approverIds);
    const { data: deals } = await admin
      .from("deals")
      .select("id, influencer_name, agency_name, platform_primary, monthly_rate_cents, total_months, rationale, deliverables, contract_sequence, instagram_handle, tiktok_handle, youtube_handle")
      .in("id", dealIds);

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const reviewUrl = `${portalUrl}/review/${packet.id}?token=${reviewToken}`;

    // "From" — display name configurable, sending address is the SMTP user
    const senderName = process.env.APPROVAL_SENDER_NAME ?? "Diana";
    const smtpUser = process.env.SMTP_USER ?? "partners@im8health.com";
    const fromHeader = `${senderName} <${smtpUser}>`;

    // Reply-To routes responses back to the sender's inbox
    const replyTo = process.env.APPROVAL_REPLY_TO ?? smtpUser;

    // CC addresses (comma-separated)
    const ccAddresses = (process.env.APPROVAL_CC_EMAILS ?? "")
      .split(",").map(e => e.trim()).filter(Boolean);

    const transporter = createTransporter();

    await Promise.all((approvers ?? []).map(approver => {
      const { subject, text, html } = approvalRequestTemplate({
        approverName: approver.full_name ?? "there",
        senderName,
        batchTitle: title,
        batchNote: trimmedNote || null,
        reviewUrl,
        deals: (deals ?? []) as Parameters<typeof approvalRequestTemplate>[0]["deals"],
      });
      return transporter.sendMail({
        from: fromHeader,
        replyTo,
        to: approver.email,
        cc: ccAddresses.length ? ccAddresses.join(", ") : undefined,
        subject,
        text,
        html,
      });
    }));
  } catch (err) {
    console.error("[create-packet] Email send failed:", err);
  }

  return NextResponse.json({ id: packet.id });
}
