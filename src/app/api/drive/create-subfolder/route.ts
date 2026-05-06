import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInfluencerFolder, createSubFolder, extractFolderId } from "@/lib/google/drive";

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
    .select("influencer_name, influencer_profile_id, drive_folder_id, contract_sequence")
    .eq("id", dealId)
    .single();

  if (dealErr || !deal) {
    return NextResponse.json(
      { error: dealErr?.message || "Deal not found" },
      { status: dealErr ? 500 : 404 }
    );
  }

  // Already has a folder — return it
  if (deal.drive_folder_id) {
    return NextResponse.json({
      folderId: deal.drive_folder_id,
      folderUrl: `https://drive.google.com/drive/folders/${deal.drive_folder_id}`,
      alreadyLinked: true,
    });
  }

  if (!process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      { error: "Drive not configured — ask your administrator to set GOOGLE_DRIVE_MASTER_FOLDER_ID" },
      { status: 500 }
    );
  }

  try {
    const influencerName = (deal.influencer_name as string) ?? "Unknown";
    const contractSeq = (deal.contract_sequence as number | null) ?? 1;
    const contractLabel = `Contract ${contractSeq}`;

    // ── 2. Try to find or create the partner's top-level folder ───────────────

    let partnerFolderId: string | null = null;
    let creatorEmail = "";

    // If deal is linked to a profile, check for an existing folder there first
    if (deal.influencer_profile_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("drive_folder_url, email")
        .eq("id", deal.influencer_profile_id)
        .single();

      creatorEmail = (profile?.email as string | null) ?? "";

      if (profile?.drive_folder_url) {
        partnerFolderId = extractFolderId(profile.drive_folder_url as string);
      }
    }

    // Check if any other deal for the same influencer already has a folder
    // (so we share one partner-level folder across all their contracts)
    if (!partnerFolderId) {
      const { data: siblingDeals } = await admin
        .from("deals")
        .select("drive_folder_id, influencer_profile_id")
        .eq("influencer_name", influencerName)
        .not("id", "eq", dealId)
        .not("drive_folder_id", "is", null);

      if (siblingDeals && siblingDeals.length > 0) {
        // A sibling exists; its drive_folder_id is a contract subfolder
        // so we can't directly use it — we need to create within the same parent.
        // For simplicity, fall through to create a fresh partner folder.
        // (Drive API parent traversal would be needed to reuse the sibling's parent.)
      }
    }

    // ── 3. Create partner top-level folder if we don't have one ───────────────
    if (!partnerFolderId) {
      const partnerFolderName = `IM8_${influencerName
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, "")
        .trim()
        .replace(/\s+/g, "_")}`;

      const newFolderUrl = await createInfluencerFolder(partnerFolderName, creatorEmail);
      partnerFolderId = extractFolderId(newFolderUrl);

      // Store on profile if linked
      if (deal.influencer_profile_id && partnerFolderId) {
        await admin
          .from("profiles")
          .update({ drive_folder_url: newFolderUrl })
          .eq("id", deal.influencer_profile_id);
      }
    }

    if (!partnerFolderId) {
      return NextResponse.json({ error: "Could not determine partner Drive folder" }, { status: 500 });
    }

    // ── 4. Create the Contract N subfolder ────────────────────────────────────
    const { folderId: contractFolderId, folderUrl: contractFolderUrl } = await createSubFolder(
      partnerFolderId,
      contractLabel,
      creatorEmail || undefined,
    );

    // ── 5. Persist to deal ────────────────────────────────────────────────────
    await admin
      .from("deals")
      .update({ drive_folder_id: contractFolderId })
      .eq("id", dealId);

    return NextResponse.json({
      folderId: contractFolderId,
      folderUrl: contractFolderUrl,
      partnerFolderId,
      created: true,
    });
  } catch (driveErr) {
    console.error("[create-subfolder] Drive folder creation failed:", driveErr);
    return NextResponse.json(
      { error: driveErr instanceof Error ? driveErr.message : "Drive folder creation failed" },
      { status: 500 }
    );
  }
}
