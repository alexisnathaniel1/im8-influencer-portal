import { after } from "next/server";
import { performAIReview } from "./review";
import { createAdminClient } from "@/lib/supabase/admin";

export async function triggerAIReview(submissionId: string, driveFileId: string) {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("ai_reviews")
    .select("id")
    .eq("submission_id", submissionId)
    .single();

  if (!existing) {
    await supabase.from("ai_reviews").insert({
      submission_id: submissionId,
      status: "pending",
    });
  } else {
    await supabase.from("ai_reviews").update({
      status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("submission_id", submissionId);
  }

  after(async () => {
    await performAIReview(submissionId, driveFileId);
  });
}
