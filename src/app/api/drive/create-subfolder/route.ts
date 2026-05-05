import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInfluencerFolder, extractFolderId } from "@/lib/google/drive";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await request.json();
  if (!dealId) return NextResponse.json({ error: "dealId required" }, { status: 400 });

  const admin = createAdminClient();

  // ── 1. Load the deal ───────────────────────────────────────────────────────
  const { data: deal, error: dealErr } = await admin
    .from("deals")
    .select("influencer_name, influencer_profile_id, drive_folder_id")
    .eq("id", dealId)
    .single();

  if (dealErr || !deal) {
    console.error("[create-subfolder] deal lookup failed:", dealErr?.message ?? "no row", "dealId:", dealId);
    return NextResponse.json(
      { error: dealErr?.message || "Deal not found" },
      { status: dealErr ? 500 : 404 }
    );
  }

  // Already linked — nothing to do
  if (deal.drive_folder_id) {
    return NextResponse.json({ folderId: deal.drive_folder_id, alreadyLinked: true });
  }

  if (!deal.influencer_profile_id) {
    return NextResponse.json({ error: "Deal has no linked partner profile" }, { status: 400 });
  }

  // ── 2. Check whether the creator already has a Drive folder ────────────────
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("drive_folder_url, email")
    .eq("id", deal.influencer_profile_id)
    .single();

  if (profileErr) {
    console.error("[create-subfolder] profile lookup failed:", profileErr.message);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // ── 3a. Profile already has a folder (auto-created during first upload) ─────
  //    Just link that folder to the deal — no need to create another one.
  if (profile?.drive_folder_url) {
    const folderId = extractFolderId(profile.drive_folder_url);
    if (folderId) {
      const { error: updateErr } = await admin
        .from("deals")
        .update({ drive_folder_id: folderId })
        .eq("id", dealId);

      if (updateErr) {
        console.error("[create-subfolder] deal update failed:", updateErr.message);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ folderId, folderUrl: profile.drive_folder_url, linked: true });
    }
  }

  // ── 3b. No folder exists at all — create one in the master Drive folder ──────
  if (!process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      { error: "Drive not configured — ask your administrator to set GOOGLE_DRIVE_MASTER_FOLDER_ID" },
      { status: 500 }
    );
  }

  try {
    const folderName = `IM8_${(deal.influencer_name as string)
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "_")}`;

    const newFolderUrl = await createInfluencerFolder(
      folderName,
      (profile?.email as string | null) ?? ""
    );

    const folderId = extractFolderId(newFolderUrl);

    // Persist to both profile and deal so future uploads use this folder
    await Promise.all([
      admin.from("profiles")
        .update({ drive_folder_url: newFolderUrl })
        .eq("id", deal.influencer_profile_id),
      admin.from("deals")
        .update({ drive_folder_id: folderId })
        .eq("id", dealId),
    ]);

    return NextResponse.json({ folderId, folderUrl: newFolderUrl, created: true });
  } catch (driveErr) {
    console.error("[create-subfolder] Drive folder creation failed:", driveErr);
    return NextResponse.json(
      { error: driveErr instanceof Error ? driveErr.message : "Drive folder creation failed" },
      { status: 500 }
    );
  }
}
