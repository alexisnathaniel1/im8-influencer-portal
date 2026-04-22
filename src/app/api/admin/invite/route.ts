import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
  const redirectTo = `${siteUrl}/auth/callback`;

  // Try invite first (new users — Supabase sends the email)
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!inviteError) return NextResponse.json({ success: true });

  // Existing user — generate a magic link and send it ourselves
  if (inviteError.message.toLowerCase().includes("already")) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: linkError?.message ?? "Could not generate link" }, { status: 400 });
    }

    const link = linkData.properties.action_link;
    const transporter = createTransporter();
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Your IM8 Influencer Portal access",
      html: `
        <p>Hi,</p>
        <p>Here is your link to access the IM8 Influencer Portal:</p>
        <p><a href="${link}" style="color:#8B1A1A;font-weight:bold;">Access the portal →</a></p>
        <p>This link expires in 24 hours.</p>
        <p>— IM8 Influencer Team</p>
      `,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: inviteError.message }, { status: 400 });
}
