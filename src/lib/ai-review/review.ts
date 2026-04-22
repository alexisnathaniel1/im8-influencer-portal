import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { getDriveAccessToken } from "@/lib/google/drive";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt, AI_REVIEW_USER_PROMPT, type AIReviewResponse } from "./prompt";
import * as fsSync from "fs";
import * as pathLib from "path";
import * as os from "os";
import * as crypto from "crypto";

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const GEMINI_MODEL = "gemini-2.0-flash";

function detectMimeType(buffer: Buffer): string {
  if (buffer.length >= 12) {
    const ftyp = buffer.toString("ascii", 4, 8);
    if (ftyp === "ftyp") return "video/mp4";
  }
  if (buffer.length >= 4) {
    const webm = buffer.toString("hex", 0, 4);
    if (webm === "1a45dfa3") return "video/webm";
  }
  return "video/mp4";
}

async function waitForFileActive(fileManager: GoogleAIFileManager, fileName: string): Promise<string> {
  const MAX_WAIT_MS = 5 * 60 * 1000;
  const POLL_INTERVAL_MS = 4000;
  const deadline = Date.now() + MAX_WAIT_MS;
  let file = await fileManager.getFile(fileName);

  while (file.state === FileState.PROCESSING) {
    if (Date.now() > deadline) throw new Error("Gemini file processing timed out after 5 minutes");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    file = await fileManager.getFile(fileName);
  }

  if (file.state === FileState.FAILED) throw new Error(`Gemini file processing failed: ${file.name}`);
  return file.uri;
}

export async function performAIReview(submissionId: string, fileId: string): Promise<void> {
  const supabase = createAdminClient();
  const startTime = Date.now();

  await supabase.from("ai_reviews")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("submission_id", submissionId);

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    await supabase.from("ai_reviews").update({
      status: "failed",
      error_message: "GEMINI_API_KEY environment variable is not set",
      processing_time_ms: Date.now() - startTime,
      updated_at: new Date().toISOString(),
    }).eq("submission_id", submissionId);
    return;
  }

  let uploadedFileName: string | null = null;
  const sessionId = crypto.randomBytes(8).toString("hex");
  const tmpDir = pathLib.join(os.tmpdir(), `ai-review-${sessionId}`);

  try {
    const accessToken = await getDriveAccessToken();
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!driveResponse.ok) {
      throw new Error(`Drive download failed: ${driveResponse.status} ${driveResponse.statusText}`);
    }

    const videoBuffer = Buffer.from(await driveResponse.arrayBuffer());
    const videoSizeBytes = videoBuffer.length;

    if (videoSizeBytes > MAX_VIDEO_SIZE) {
      await supabase.from("ai_reviews").update({
        status: "skipped",
        video_size_bytes: videoSizeBytes,
        error_message: `Video is ${(videoSizeBytes / 1024 / 1024).toFixed(1)}MB — exceeds 200MB limit. Admin will review manually.`,
        updated_at: new Date().toISOString(),
      }).eq("submission_id", submissionId);
      return;
    }

    const mimeType = detectMimeType(videoBuffer);
    const ext = mimeType === "video/webm" ? "webm" : "mp4";
    fsSync.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = pathLib.join(tmpDir, `video.${ext}`);
    fsSync.writeFileSync(tmpPath, videoBuffer);

    const fileManager = new GoogleAIFileManager(apiKey);
    const uploadResult = await fileManager.uploadFile(tmpPath, {
      mimeType,
      displayName: `submission-${submissionId}`,
    });
    uploadedFileName = uploadResult.file.name;
    const fileUri = await waitForFileActive(fileManager, uploadedFileName);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: buildSystemPrompt(),
    });

    const result = await model.generateContent([
      { fileData: { mimeType, fileUri } },
      { text: AI_REVIEW_USER_PROMPT },
    ]);

    const responseText = result.response.text();
    if (!responseText) throw new Error("Gemini returned an empty response");

    const review = parseReviewJSON(responseText);
    const processingTimeMs = Date.now() - startTime;

    await supabase.from("ai_reviews").update({
      status: "completed",
      framework_score: clampScore(review.framework_score),
      framework_feedback: review.framework_feedback || "",
      authenticity_score: clampScore(review.authenticity_score),
      authenticity_feedback: review.authenticity_feedback || "",
      algorithm_score: clampScore(review.algorithm_score),
      algorithm_feedback: review.algorithm_feedback || "",
      general_notes: review.general_notes || "",
      recommendation: review.recommendation,
      recommendation_reason: review.recommendation_reason || "",
      brand_compliance_issues: review.brand_compliance_issues || [],
      detected_content_angle: review.detected_content_angle || null,
      model_used: GEMINI_MODEL,
      video_size_bytes: videoSizeBytes,
      processing_time_ms: processingTimeMs,
      updated_at: new Date().toISOString(),
    }).eq("submission_id", submissionId);
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown error during AI review";
    console.error(`AI review failed for submission ${submissionId}:`, message);
    await supabase.from("ai_reviews").update({
      status: "failed",
      error_message: message.slice(0, 1000),
      processing_time_ms: processingTimeMs,
      updated_at: new Date().toISOString(),
    }).eq("submission_id", submissionId);
  } finally {
    try { fsSync.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    if (uploadedFileName) {
      try {
        const fileManager = new GoogleAIFileManager(apiKey!);
        await fileManager.deleteFile(uploadedFileName);
      } catch { /* expires automatically after 48h */ }
    }
  }
}

function clampScore(score: unknown): number {
  const n = typeof score === "number" ? score : Number(score);
  if (isNaN(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function parseReviewJSON(text: string): AIReviewResponse {
  try { return JSON.parse(text); } catch { /* continue */ }
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) { try { return JSON.parse(jsonMatch[1].trim()); } catch { /* continue */ } }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* continue */ }
  }
  throw new Error(`Failed to parse Gemini response as JSON: ${text.slice(0, 300)}`);
}
