import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiateResumableUpload, extractFolderId } from "@/lib/google/drive";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { briefId, dealId, mimeType, fileSize, fileHash } = await request.json();

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
        .select("drive_folder_url")
        .eq("id", user.id)
        .single();

      if (profile?.drive_folder_url) {
        folderId = extractFolderId(profile.drive_folder_url);
      }
    }

    if (!folderId) {
      return NextResponse.json({ error: "No Drive folder found. Please contact your IM8 manager." }, { status: 400 });
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
    const fileName = `${dealName}_${timestamp}`;
    const clientOrigin = request.headers.get("origin") || `https://${request.headers.get("host")}`;

    const { sessionUri } = await initiateResumableUpload(folderId, fileName, mimeType, fileSize, clientOrigin);

    return NextResponse.json({ sessionUri, fileName });
  } catch (error) {
    console.error("Upload session error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create upload session" }, { status: 500 });
  }
}
