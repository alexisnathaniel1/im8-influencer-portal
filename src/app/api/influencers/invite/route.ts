import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId, email, fullName } = await request.json();
  if (!dealId || !email) return NextResponse.json({ error: "dealId and email are required" }, { status: 400 });

  const admin = createAdminClient();

  // Create auth account with a temporary password — influencer will reset on first login
  const tempPassword = crypto.randomUUID();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName || "" },
  });

  if (authError) {
    if (authError.message.includes("already registered")) {
      // User exists — just link the deal and send a welcome email
      const { data: existing } = await admin.from("profiles").select("id").eq("email", email).single();
      if (existing) {
        await admin.from("deals").update({ influencer_profile_id: existing.id }).eq("id", dealId);
        return NextResponse.json({ success: true, alreadyExisted: true });
      }
    }
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const influencerId = authData.user.id;

  // Link deal to influencer
  await admin.from("deals").update({ influencer_profile_id: influencerId }).eq("id", dealId);

  // Send onboarding email with password reset link
  const { data: resetData } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const resetLink = resetData?.properties?.action_link || `${portalUrl}/auth/login`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "[IM8] Welcome — set up your influencer portal access",
      text: `Hi ${fullName || "there"},\n\nWelcome to the IM8 Influencer Portal! Your account has been created.\n\nSet your password and access your briefs here:\n${resetLink}\n\nThis link expires in 24 hours.\n\nThank you,\nIM8 Influencer Team`,
      html: `<p>Hi ${fullName || "there"},</p><p>Welcome to the IM8 Influencer Portal! Your account has been created.</p><p><a href="${resetLink}" style="background:#A40011;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Set Password & Access Portal →</a></p><p style="color:#666;font-size:12px">This link expires in 24 hours.</p>`,
    });
  } catch (err) {
    console.error("[invite] Email send failed:", err);
  }

  return NextResponse.json({ success: true, influencerId });
}
