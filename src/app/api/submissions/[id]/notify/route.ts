import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";
import { contentApprovedTemplate } from "@/lib/email/templates/content-approved";
import { revisionRequestedTemplate } from "@/lib/email/templates/revision-requested";

// Called fire-and-forget from the review page after a submission status change.
// Sends the appropriate email to the creator/agency.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, feedback } = await request.json() as {
    action: "approved" | "revision_requested" | "rejected";
    feedback?: string;
  };

  if (!["approved", "revision_requested", "rejected"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: submission } = await admin
    .from("submissions")
    .select("deal_id, deliverable_id")
    .eq("id", id)
    .single();

  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: deal } = await admin
    .from("deals")
    .select("influencer_name, influencer_email")
    .eq("id", submission.deal_id)
    .single();

  if (!deal?.influencer_email) {
    return NextResponse.json({ ok: true, skipped: "no email" });
  }

  let deliverableType = "Content";
  let sequence: number | null = null;
  if (submission.deliverable_id) {
    const { data: deliv } = await admin
      .from("deliverables")
      .select("deliverable_type, sequence")
      .eq("id", submission.deliverable_id)
      .single();
    deliverableType = deliv?.deliverable_type ?? "Content";
    sequence = (deliv?.sequence as number | null) ?? null;
  }

  try {
    const transporter = createTransporter();
    const portalUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (action === "approved") {
      const { subject, text, html } = contentApprovedTemplate({
        creatorName: deal.influencer_name ?? "Creator",
        deliverableType,
        sequence,
        portalUrl,
      });
      await transporter.sendMail({ from: EMAIL_FROM, to: deal.influencer_email, subject, text, html });
    } else if (action === "revision_requested") {
      const { subject, text, html } = revisionRequestedTemplate({
        creatorName: deal.influencer_name ?? "Creator",
        deliverableType,
        sequence,
        feedback: feedback ?? null,
        portalUrl,
      });
      await transporter.sendMail({ from: EMAIL_FROM, to: deal.influencer_email, subject, text, html });
    }
    // "rejected" — no email for now (same as revision_requested in practice)
  } catch (e) {
    console.error("[submissions/notify] Email failed:", e);
    // Still return OK — email failure shouldn't bubble back to the reviewer
  }

  return NextResponse.json({ ok: true });
}
