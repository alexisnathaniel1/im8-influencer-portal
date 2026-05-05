import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiateResumableUpload, extractFolderId, createInfluencerFolder } from "@/lib/google/drive";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { briefId, dealId, deliverableId, mimeType, fileSize, fileHash } = await request.json();

    if (!mimeType || !fileSize) {
      return NextResponse.json({ error: "mimeType and fileSize are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Resolve which Drive folder to upload into
    let folderId: string | null = null;
    let dealName = "upload";

    if (dealId) {
      // Deal with a sub-folder (agency talent) takes priority
      const { data: deal } = await admin
        .from("deals")
        .select("influencer_name, drive_folder_id")
        .eq("id", dealId)
        .single();

      if (deal) {
        dealName = deal.influencer_name.replace(/\s+/g, "_").toLowerCase();
        if (deal.drive_folder_id) {
          folderId = deal.drive_folder_id;
        }
      }
    }

    if (!folderId) {
      // Fall back to the influencer's own Drive folder
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, email, drive_folder_url")
        .eq("id", user.id)
        .single();

      if (profile?.drive_folder_url) {
        folderId = extractFolderId(profile.drive_folder_url);
      }

      // Auto-create a Drive folder if the creator doesn't have one yet
      if (!folderId && process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
          const folderName = `IM8_${(profile?.full_name || dealName).toUpperCase().replace(/\s+/g, "_")}`;
          const creatorEmail = profile?.email ?? "";
          const newFolderUrl = await createInfluencerFolder(folderName, creatorEmail);
          await admin.from("profiles").update({ drive_folder_url: newFolderUrl }).eq("id", user.id);
          folderId = extractFolderId(newFolderUrl);
        } catch (err) {
          console.error("[upload-session] Auto folder creation failed:", err);
        }
      }
    }

    if (!folderId) {
      return NextResponse.json({ error: "No Drive folder found. Please contact your IM8 manager to set up your content folder." }, { status: 400 });
    }

    // Block duplicate file uploads for the same brief
    if (fileHash && briefId) {
      const { data: dup } = await supabase
        .from("submissions")
        .select("id")
        .eq("brief_id", briefId)
        .eq("file_hash", fileHash)
        .not("status", "in", '("rejected")')
        .limit(1);
      if (dup && dup.length > 0) {
        return NextResponse.json({ error: "This file has already been submitted for this brief." }, { status: 409 });
      }
    }

    const timestamp = Date.now();
    let canonicalName = dealName;
    let draftNum: number | null = null;

    // Build a human-readable canonical filename when deliverable context is available
    if (deliverableId) {
      const [delivResult, countResult] = await Promise.all([
        admin
          .from("deliverables")
          .select("deliverable_type, sequence, deal:deal_id(contract_sequence, influencer_name)")
          .eq("id", deliverableId)
          .single(),
        admin
          .from("submissions")
          .select("*", { count: "exact", head: true })
          .eq("deliverable_id", deliverableId),
      ]);

      const deliv = delivResult.data;
      if (deliv) {
        const deal2 = Array.isArray(deliv.deal) ? deliv.deal[0] : deliv.deal as { contract_sequence: number | null; influencer_name: string } | null;
        const name = (deal2?.influencer_name ?? dealName)
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim()
          .replace(/\s+/g, "_");
        const contractSeq = deal2?.contract_sequence ?? 1;
        const delivType = (deliv.deliverable_type ?? "CONTENT").replace(/[^a-zA-Z0-9_]/g, "");
        const seqSuffix = deliv.sequence ? `${deliv.sequence}` : "1";
        canonicalName = `${name}_Contract${contractSeq}_${delivType}${seqSuffix}`;
      }
      // Draft number = existing submissions for this deliverable + 1
      draftNum = (countResult.count ?? 0) + 1;
    }

    // Use DRAFT_N suffix when uploading for a deliverable; fall back to timestamp for misc uploads
    const fileName = draftNum !== null
      ? `${canonicalName}_DRAFT_${draftNum}`
      : `${canonicalName}_${timestamp}`;
    const clientOrigin = request.headers.get("origin") || `https://${request.headers.get("host")}`;

    const { sessionUri } = await initiateResumableUpload(folderId, fileName, mimeType, fileSize, clientOrigin);

    return NextResponse.json({ sessionUri, fileName });
  } catch (error) {
    console.error("Upload session error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create upload session" }, { status: 500 });
  }
}
