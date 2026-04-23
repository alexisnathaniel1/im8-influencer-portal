import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";
import { partnerInviteTemplate } from "@/lib/email/templates/partner-invite";
import { randomUUID } from "crypto";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: senderProfile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!["admin", "management", "support"].includes(senderProfile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: deal } = await admin
    .from("deals")
    .select("id, influencer_name, influencer_email, partner_invite_token")
    .eq("id", id)
    .single();

  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  if (!deal.influencer_email) return NextResponse.json({ error: "No email on this deal" }, { status: 400 });

  // Generate / reuse invite token
  const token = deal.partner_invite_token ?? randomUUID();
  await admin
    .from("deals")
    .update({ partner_invite_token: token, partner_invite_sent_at: new Date().toISOString() })
    .eq("id", id);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const emailParam = encodeURIComponent(deal.influencer_email);
  const nameParam = encodeURIComponent(deal.influencer_name);
  const inviteUrl = `${siteUrl}/auth/signup?deal_invite=${token}&email=${emailParam}&name=${nameParam}`;

  const { subject, text, html } = partnerInviteTemplate({
    influencerName: deal.influencer_name,
    inviteUrl,
    adminName: senderProfile?.full_name ?? null,
  });

  try {
    await createTransporter().sendMail({
      from: EMAIL_FROM,
      to: deal.influencer_email,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("[deals/invite] Email failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true, inviteUrl });
}
