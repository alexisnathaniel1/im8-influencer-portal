import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";
import { discoveryNotifyTemplate } from "@/lib/email/templates/discovery-notify";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!to) return NextResponse.json({ error: "Missing recipient" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "ops", "finance"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: discovery } = await admin
    .from("discovery_profiles")
    .select("influencer_name, status")
    .eq("id", id)
    .single();

  if (!discovery) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const portalUrl = siteUrl ? `${siteUrl}/partner` : null;

  const { subject, text, html } = discoveryNotifyTemplate({
    influencerName: discovery.influencer_name,
    status: discovery.status,
    message: message || null,
    portalUrl,
  });

  try {
    await createTransporter().sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("[discovery/notify] Email send failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  const { data: comment } = await admin
    .from("discovery_comments")
    .insert({
      discovery_profile_id: id,
      author_id: user.id,
      author_display_name: profile.full_name || "Admin",
      body: `Notified ${to}${message ? `:\n\n${message}` : ""}`,
      visible_to_partner: true,
      kind: "notify",
    })
    .select("*")
    .single();

  return NextResponse.json({ success: true, comment });
}
