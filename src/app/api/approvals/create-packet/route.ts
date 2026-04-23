import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, dealIds, approverIds } = await request.json();

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

  try {
    const { data: approvers } = await admin.from("profiles").select("email, full_name").in("id", approverIds);
    const { data: deals } = await admin.from("deals").select("influencer_name, monthly_rate_cents, total_months, total_rate_cents").in("id", dealIds);

    const dealListText = (deals ?? []).map(d =>
      `• ${d.influencer_name} — $${d.monthly_rate_cents ? (d.monthly_rate_cents / 100).toFixed(0) : "??"}/mo × ${d.total_months}mo`
    ).join("\n");

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const reviewUrl = `${portalUrl}/review/${packet.id}?token=${reviewToken}`;

    // "From" Diana — display name configurable, sending address is the SMTP user
    const senderName = process.env.APPROVAL_SENDER_NAME ?? "Diana";
    const smtpUser = process.env.SMTP_USER ?? "creators@im8health.com";
    const fromHeader = `${senderName} <${smtpUser}>`;

    // Reply-To Diana's actual email so Rob's reply goes to her inbox
    const replyTo = process.env.APPROVAL_REPLY_TO ?? smtpUser;

    // CC addresses (comma-separated) — Rob, Sam, anyone else
    const ccAddresses = (process.env.APPROVAL_CC_EMAILS ?? "")
      .split(",").map(e => e.trim()).filter(Boolean);

    const transporter = createTransporter();

    await Promise.all((approvers ?? []).map(approver =>
      transporter.sendMail({
        from: fromHeader,
        replyTo,
        to: approver.email,
        cc: ccAddresses.length ? ccAddresses.join(", ") : undefined,
        subject: `[IM8] Partnership approval needed: ${title}`,
        text: [
          `Hi ${approver.full_name},`,
          ``,
          `I have a new batch of influencer partnerships ready for your review.`,
          ``,
          `Batch: ${title}`,
          `Influencers:`,
          dealListText,
          ``,
          `Please review and leave your approval or comments here:`,
          reviewUrl,
          ``,
          `No login required — just click the link above.`,
          ``,
          `Thanks,`,
          senderName,
        ].join("\n"),
        html: `
<p>Hi ${approver.full_name},</p>
<p>I have a new batch of influencer partnerships ready for your review.</p>
<p><strong>${title}</strong></p>
<ul style="font-family:monospace;background:#f8f8f8;padding:16px;border-radius:6px;list-style:none;margin:0">
  ${(deals ?? []).map(d => `<li style="margin-bottom:4px">• ${d.influencer_name} — $${d.monthly_rate_cents ? (d.monthly_rate_cents / 100).toFixed(0) : "??"}/mo × ${d.total_months}mo</li>`).join("")}
</ul>
<p style="margin-top:24px">
  <a href="${reviewUrl}" style="background:#A40011;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">
    Leave your approval or comments →
  </a>
</p>
<p style="color:#999;font-size:13px">No login required. You can approve, request changes, or leave a comment and it will appear in the portal.</p>
<p style="margin-top:24px">Thanks,<br/>${senderName}</p>
        `.trim(),
      })
    ));
  } catch (err) {
    console.error("[create-packet] Email send failed:", err);
  }

  return NextResponse.json({ id: packet.id });
}
