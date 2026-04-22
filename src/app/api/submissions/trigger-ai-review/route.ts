import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractDriveFileId } from "@/lib/google/drive";
import { triggerAIReview } from "@/lib/ai-review/trigger";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { submissionId } = await request.json();
    if (!submissionId) return NextResponse.json({ error: "submissionId is required" }, { status: 400 });

    const { data: submission } = await supabase
      .from("submissions")
      .select("id, drive_url, drive_file_id, status")
      .eq("id", submissionId)
      .single();

    if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    if (submission.status !== "pending") return NextResponse.json({ skipped: true, reason: "not pending" });

    const fileId = submission.drive_file_id || (submission.drive_url ? extractDriveFileId(submission.drive_url) : null);
    if (!fileId) return NextResponse.json({ skipped: true, reason: "no drive file id" });

    triggerAIReview(submissionId, fileId);

    return NextResponse.json({ triggered: true });
  } catch (error) {
    console.error("Trigger AI review error:", error);
    return NextResponse.json({ error: "Failed to trigger AI review" }, { status: 500 });
  }
}
