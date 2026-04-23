import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInfluencerFolder, createSubFolder, extractFolderId } from "@/lib/google/drive";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const admin = createAdminClient();

  // Find the deal this token belongs to
  const { data: deal } = await admin
    .from("deals")
    .select("id, influencer_name, influencer_email, influencer_profile_id, drive_folder_id")
    .eq("partner_invite_token", token)
    .single();

  if (!deal) return NextResponse.json({ error: "Invalid or expired invite token" }, { status: 404 });

  // If already linked to a different user, reject
  if (deal.influencer_profile_id && deal.influencer_profile_id !== user.id) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 409 });
  }

  // Link the profile
  await admin
    .from("deals")
    .update({
      influencer_profile_id: user.id,
      partner_invite_token: null, // single-use — clear it
    })
    .eq("id", deal.id);

  // Update the profile's email to match the deal's email (in case they signed up with a different one)
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, drive_folder_url")
    .eq("id", user.id)
    .single();

  // Create Drive folder if not already created and service account is configured
  let driveFolderUrl: string | null = profile?.drive_folder_url ?? null;
  if (!driveFolderUrl && process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const folderName = `IM8_${deal.influencer_name.toUpperCase().replace(/\s+/g, "_")}`;
      const email = profile?.email ?? user.email ?? deal.influencer_email ?? "";
      driveFolderUrl = await createInfluencerFolder(folderName, email);
      await admin.from("profiles").update({ drive_folder_url: driveFolderUrl }).eq("id", user.id);
    } catch (err) {
      console.error("[accept-invite] Drive folder creation failed (non-fatal):", err);
    }
  }

  // Create deal subfolder if profile folder exists but deal folder doesn't
  if (driveFolderUrl && !deal.drive_folder_id) {
    try {
      const parentFolderId = extractFolderId(driveFolderUrl);
      if (parentFolderId) {
        const subFolderName = deal.influencer_name.replace(/\s+/g, "_");
        const { folderId } = await createSubFolder(parentFolderId, subFolderName);
        await admin.from("deals").update({ drive_folder_id: folderId }).eq("id", deal.id);
      }
    } catch (err) {
      console.error("[accept-invite] Drive subfolder creation failed (non-fatal):", err);
    }
  }

  return NextResponse.json({ success: true, dealId: deal.id, driveFolderUrl });
}
