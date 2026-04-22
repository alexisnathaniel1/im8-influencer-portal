import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractDriveFileId, renameDriveFile } from "@/lib/google/drive";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { driveUrl, expectedName } = await req.json();
    if (!driveUrl || !expectedName) return NextResponse.json({ error: "Missing driveUrl or expectedName" }, { status: 400 });

    const fileId = extractDriveFileId(driveUrl);
    if (!fileId) return NextResponse.json({ error: "Could not extract file ID from Drive URL" }, { status: 400 });

    const result = await renameDriveFile(fileId, expectedName);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Drive rename error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to rename file" }, { status: 500 });
  }
}
