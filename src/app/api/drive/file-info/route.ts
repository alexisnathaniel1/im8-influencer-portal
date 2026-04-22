import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractDriveFileId, getDriveFileMetadata } from "@/lib/google/drive";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const driveUrl = new URL(req.url).searchParams.get("driveUrl") ?? "";
    if (!driveUrl) return NextResponse.json({ error: "Missing driveUrl" }, { status: 400 });

    const fileId = extractDriveFileId(driveUrl);
    if (!fileId) return NextResponse.json({ error: "Could not extract file ID from Drive URL" }, { status: 400 });

    const metadata = await getDriveFileMetadata(fileId);
    return NextResponse.json({ ...metadata, fileId });
  } catch (error) {
    console.error("file-info error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to get file info" }, { status: 500 });
  }
}
