import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listFolderFiles } from "@/lib/google/drive";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const masterFolderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID ?? "";
    if (!masterFolderId) return NextResponse.json({ error: "Drive folder not configured" }, { status: 500 });

    const files = await listFolderFiles(masterFolderId);

    return NextResponse.json({
      totalFiles: files.length,
      files: files.map((f) => ({
        fileId: f.id,
        fileName: f.name,
        driveUrl: f.webViewLink,
        durationSec: f.durationMs ? Math.round(f.durationMs / 1000) : null,
      })),
    });
  } catch (error) {
    console.error("Drive sync error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to sync from Drive" }, { status: 500 });
  }
}
