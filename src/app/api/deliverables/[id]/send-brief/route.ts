import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";
import { notifyBriefSent } from "@/lib/slack/notify";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Auth — admin / management only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "management"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Load deliverable with linked brief id, existing due_date, and admin_review_due_date
  const { data: deliverable } = await admin
    .from("deliverables")
    .select("id, deliverable_type, sequence, brief_doc_url, brief_id, deal_id, due_date, admin_review_due_date")
    .eq("id", id)
    .single();

  if (!deliverable) return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });

  if (!deliverable.brief_doc_url) {
    return NextResponse.json({ error: "Add the Google Doc link before sending." }, { status: 422 });
  }

  const { data: deal } = await admin
    .from("deals")
    .select("influencer_name, influencer_email")
    .eq("id", deliverable.deal_id)
    .single();

  if (!deal?.influencer_email) {
    return NextResponse.json(
      { error: "No email on file for this influencer. Add their email in the deal overview tab first." },
      { status: 422 },
    );
  }

  const label = `${deliverable.deliverable_type}${deliverable.sequence ? ` #${deliverable.sequence}` : ""}`;
  const influencerName = deal.influencer_name ?? "Creator";

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: deal.influencer_email,
      subject: `Your brief for ${label} is ready`,
      text: [
        `Hi ${influencerName},`,
        "",
        `Your content brief for ${label} is now ready. You can view it here:`,
        deliverable.brief_doc_url,
        "",
        "Please read it carefully before uploading your draft. Reach out if you have any questions!",
        "",
        "— The IM8 Creator Team",
      ].join("\n"),
      html: `
        <p>Hi ${influencerName},</p>
        <p>Your content brief for <strong>${label}</strong> is now ready.</p>
        <p>
          <a href="${deliverable.brief_doc_url}" style="display:inline-block;padding:10px 20px;background:#50000B;color:#fff;border-radius:100px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.05em;">
            View brief →
          </a>
        </p>
        <p>Please read it carefully before uploading your draft. Reach out if you have any questions!</p>
        <p>— The IM8 Creator Team</p>
      `,
    });
  } catch (err) {
    console.error("[send-brief] Email send failed", {
      deliverableId: id,
      dealId: deliverable.deal_id,
      to: deal.influencer_email,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Failed to send email. Check SMTP configuration." }, { status: 500 });
  }

  // ── Record timestamps + auto-calculate due dates ──────────────────────────
  const now = new Date();

  // Creator submit deadline: +10 days from brief send
  const day10 = new Date(now);
  day10.setDate(now.getDate() + 10);

  // Admin review deadline: +13 days from brief send (10 filming + 3 review)
  const day13 = new Date(now);
  day13.setDate(now.getDate() + 13);

  await admin.from("deliverables").update({
    status: "in_progress",
    brief_sent_at: now.toISOString(),
    brief_sent_by: user.id,
    // Only set deadlines if not already manually entered
    due_date: (deliverable.due_date as string | null) ?? day10.toISOString().split("T")[0],
    admin_review_due_date: (deliverable.admin_review_due_date as string | null) ?? day13.toISOString().split("T")[0],
  }).eq("id", id);

  // Ensure a briefs-table row exists and is marked sent so it appears on /partner/briefs
  let briefId = deliverable.brief_id as string | null;

  if (briefId) {
    // Brief record already exists — just mark it sent
    await admin.from("briefs").update({
      status: "sent",
      sent_at: now.toISOString(),
    }).eq("id", briefId);
  } else {
    // No brief record yet — auto-create one from the deliverable's brief_doc_url
    const { data: dealForBrief } = await admin
      .from("deals")
      .select("platform_primary")
      .eq("id", deliverable.deal_id)
      .single();

    const { data: newBrief } = await admin
      .from("briefs")
      .insert({
        deal_id: deliverable.deal_id,
        title: `Brief for ${label}`,
        body_markdown: "",
        google_doc_url: deliverable.brief_doc_url,
        platform: (dealForBrief as { platform_primary?: string } | null)?.platform_primary ?? null,
        deliverable_type: deliverable.deliverable_type as string,
        due_date: day10.toISOString().split("T")[0],
        status: "sent",
        sent_at: now.toISOString(),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (newBrief?.id) {
      briefId = newBrief.id;
      // Link the new brief back to this deliverable
      await admin
        .from("deliverables")
        .update({ brief_id: newBrief.id })
        .eq("id", id);
    }
  }

  // ── Slack notification (fire-and-forget) ─────────────────────────────────
  notifyBriefSent({
    influencerName: influencerName,
    deliverableLabel: label,
    adminName: (profile as { full_name?: string } | null)?.full_name ?? user.email ?? "Admin",
    dealId: deliverable.deal_id as string,
  });

  return NextResponse.json({
    success: true,
    briefSentAt: now.toISOString(),
    creatorDeadline: day10.toISOString().split("T")[0],
    reviewDeadline: day13.toISOString().split("T")[0],
    briefId,
  });
}
