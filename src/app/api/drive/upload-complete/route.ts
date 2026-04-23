import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findFileInFolder, extractFolderId } from "@/lib/google/drive";
import { performAIReview } from "@/lib/ai-review/review";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { briefId, dealId, deliverableId, fileName, fileHash } = await request.json();

    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Resolve the same folder used during upload-session
    let folderId: string | null = null;

    if (dealId) {
      const { data: deal } = await admin
        .from("deals")
        .select("drive_folder_id")
        .eq("id", dealId)
        .single();
      if (deal?.drive_folder_id) folderId = deal.drive_folder_id;
    }

    if (!folderId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("drive_folder_url")
        .eq("id", user.id)
        .single();
      if (profile?.drive_folder_url) folderId = extractFolderId(profile.drive_folder_url);
    }

    if (!folderId) {
      return NextResponse.json({ error: "No Drive folder found" }, { status: 400 });
    }

    // Find uploaded file in Drive (retry once for indexing lag)
    let file = await findFileInFolder(folderId, fileName);
    if (!file) {
      await new Promise((r) => setTimeout(r, 1500));
      file = await findFileInFolder(folderId, fileName);
    }

    if (!file) {
      return NextResponse.json({ error: `File "${fileName}" not found in Drive. The upload may not have completed — please try again.` }, { status: 404 });
    }

    const { data: submissionData, error: upsertError } = await admin
      .from("submissions")
      .insert({
        deal_id: dealId || null,
        brief_id: briefId || null,
        deliverable_id: deliverableId || null,
        influencer_id: user.id,
        drive_file_id: file.id,
        drive_url: file.webViewLink,
        file_name: fileName,
        file_hash: fileHash || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    if (submissionData?.id && file.id) {
      const submissionId = submissionData.id;
      const fileId = file.id;
      after(async () => {
        await admin.from("ai_reviews").upsert(
          { submission_id: submissionId, status: "pending" },
          { onConflict: "submission_id", ignoreDuplicates: true }
        );
        await performAIReview(submissionId, fileId);
      });
    }

    return NextResponse.json({
      success: true,
      driveUrl: file.webViewLink,
      fileId: file.id,
      submissionId: submissionData?.id,
    });
  } catch (error) {
    console.error("Upload complete error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to record submission" }, { status: 500 });
  }
}
