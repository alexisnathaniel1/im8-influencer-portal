import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSubFolder, extractFolderId } from "@/lib/google/drive";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await request.json();
  if (!dealId) return NextResponse.json({ error: "dealId required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: deal } = await admin
    .from("deals")
    .select("influencer_name, influencer_profile_id, drive_folder_id")
    .eq("id", dealId)
    .single();

  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  if (deal.drive_folder_id) return NextResponse.json({ folderId: deal.drive_folder_id });
  if (!deal.influencer_profile_id) return NextResponse.json({ error: "Deal has no linked profile" }, { status: 400 });

  const { data: profile } = await admin
    .from("profiles")
    .select("drive_folder_url")
    .eq("id", deal.influencer_profile_id)
    .single();

  if (!profile?.drive_folder_url) return NextResponse.json({ error: "Profile has no Drive folder yet" }, { status: 400 });

  const parentFolderId = extractFolderId(profile.drive_folder_url);
  if (!parentFolderId) return NextResponse.json({ error: "Could not parse folder ID from profile" }, { status: 400 });

  const subFolderName = deal.influencer_name.replace(/\s+/g, "_");
  const { folderId, folderUrl } = await createSubFolder(parentFolderId, subFolderName);

  await admin.from("deals").update({ drive_folder_id: folderId }).eq("id", dealId);

  return NextResponse.json({ folderId, folderUrl });
}
