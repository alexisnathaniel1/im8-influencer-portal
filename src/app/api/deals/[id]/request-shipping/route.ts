import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";
import { requestShippingTemplate } from "@/lib/email/templates/request-shipping";
import { logAuditEvent } from "@/lib/audit/log";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: actorProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!actorProfile || !["admin", "management", "support"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: deal } = await admin
    .from("deals")
    .select("id, influencer_name, influencer_email, influencer_profile_id")
    .eq("id", id)
    .single();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  // Prefer the linked creator profile's email; fall back to deal.influencer_email.
  let recipient = deal.influencer_email ?? "";
  if (deal.influencer_profile_id) {
    const { data: creatorProfile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", deal.influencer_profile_id)
      .single();
    if (creatorProfile?.email) recipient = creatorProfile.email;
  }
  if (!recipient) {
    return NextResponse.json({ error: "No email on file for this creator" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const portalUrl = siteUrl
    ? `${siteUrl}/partner/settings?openAddress=1`
    : `/partner/settings?openAddress=1`;

  const { subject, text, html } = requestShippingTemplate({
    creatorName: deal.influencer_name || "there",
    portalUrl,
  });

  try {
    await createTransporter().sendMail({
      from: EMAIL_FROM,
      to: recipient,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("[deals/request-shipping] Email send failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  await logAuditEvent({
    actorId: user.id,
    entityType: "deal",
    entityId: id,
    action: "shipping_request_sent",
    after: { recipient },
  });

  return NextResponse.json({ success: true });
}
