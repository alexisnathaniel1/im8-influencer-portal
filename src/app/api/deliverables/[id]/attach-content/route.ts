/**
 * POST /api/deliverables/[id]/attach-content
 *
 * Attach already-approved content to a deliverable, bypassing the review queue.
 * Supports two modes:
 *   - Drive URL  (JSON body with driveUrl)
 *   - File upload (multipart/form-data with a "file" field)
 *
 * In both cases the file lands in the deal's Drive contract folder with the
 * canonical naming convention, a submission row is inserted with status="approved",
 * and the deliverable is marked completed.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractDriveFileId,
  copyDriveFile,
  uploadFileToDrive,
} from "@/lib/google/drive";
import { getOrCreateDeliverableFolder } from "@/lib/drive/deal-folders";
import { ADMIN_ROLES } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { notifyContentApproved } from "@/lib/slack/notify";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: deliverableId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Load the deliverable + linked deal in one query
    const { data: deliverable } = await admin
      .from("deliverables")
      .select(
        "id, deal_id, deliverable_type, sequence, deal:deal_id(influencer_name, influencer_profile_id, drive_folder_id, contract_sequence)",
      )
      .eq("id", deliverableId)
      .single();

    if (!deliverable) {
      return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
    }

    const deal = deliverable.deal as unknown as {
      influencer_name: string;
      influencer_profile_id: string | null;
      drive_folder_id: string | null;
      contract_sequence: number | null;
    } | null;

    if (!deal) {
      return NextResponse.json({ error: "Deal not found for deliverable" }, { status: 404 });
    }

    // ── Parse input first so variant/isScript inform the filename ──────────
    const contentType = request.headers.get("content-type") ?? "";
    let driveUrl: string | null = null;
    let uploadFile: File | null = null;
    let caption: string | null = null;
    let postUrl: string | null = null;
    let variantLabel: string | null = null;
    let isScript = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      uploadFile = formData.get("file") as File | null;
      caption = (formData.get("caption") as string | null) || null;
      postUrl = (formData.get("postUrl") as string | null) || null;
      variantLabel = (formData.get("variantLabel") as string | null) || null;
      isScript = formData.get("isScript") === "true";
      if (!uploadFile) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
    } else {
      const body = (await request.json()) as {
        driveUrl?: string;
        caption?: string;
        postUrl?: string;
        variantLabel?: string;
        isScript?: boolean;
      };
      caption = body.caption || null;
      postUrl = body.postUrl || null;
      variantLabel = body.variantLabel || null;
      isScript = !!body.isScript;
      driveUrl = body.driveUrl ?? null;
      if (!driveUrl) {
        return NextResponse.json({ error: "driveUrl is required" }, { status: 400 });
      }
    }

    // Count existing submissions for this (deliverable, variant, kind) for sequence number.
    let countQ = admin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("deliverable_id", deliverableId)
      .eq("is_script", isScript);
    countQ = variantLabel ? countQ.eq("variant_label", variantLabel) : countQ.is("variant_label", null);
    const { count: existingCount } = await countQ;
    const sequenceNumber = (existingCount ?? 0) + 1;

    // Build canonical filename
    const safeName = (deal.influencer_name ?? "creator")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();
    const contractSeq = (deal.contract_sequence as number | null) ?? 1;
    const delivType = (deliverable.deliverable_type as string | null) ?? "content";
    const delivSeq = (deliverable.sequence as number | null) ?? 1;
    const delivLabel = `${delivType.replace(/[^a-zA-Z0-9_]/g, "")}${delivSeq}`;
    const variantSlug = variantLabel
      ? variantLabel.replace(/[^a-zA-Z0-9]/g, "")
      : null;
    const suffix = isScript ? `SCRIPT_${sequenceNumber}` : `DRAFT_${sequenceNumber}`;
    const canonicalName = [
      safeName,
      `Contract${contractSeq}`,
      delivLabel,
      variantSlug,
      suffix,
    ].filter(Boolean).join("_");

    // ── Resolve destination folder (deliverable subfolder preferred) ────────
    let destFolderId = await getOrCreateDeliverableFolder(admin, deliverableId);
    if (!destFolderId) {
      destFolderId = (deal.drive_folder_id as string | null) ?? null;
    }

    // ── Copy / upload to Drive ─────────────────────────────────────────────
    let finalDriveUrl: string | null = null;
    let finalFileId: string | null = null;
    let copied = false;
    let uploaded = false;

    if (uploadFile) {
      const mimeType = uploadFile.type || "application/octet-stream";
      const originalExt = uploadFile.name.match(/\.[^.]+$/)?.[0] ?? "";
      const finalFileName = `${canonicalName}${originalExt}`;
      if (destFolderId) {
        try {
          const fileBuffer = Buffer.from(await uploadFile.arrayBuffer());
          const result = await uploadFileToDrive(fileBuffer, mimeType, finalFileName, destFolderId);
          finalFileId = result.fileId;
          finalDriveUrl = result.webViewLink;
          uploaded = true;
        } catch (uploadErr) {
          console.warn("[attach-content] Drive upload failed:", uploadErr);
        }
      } else {
        console.warn("[attach-content] No Drive folder — file uploaded but not stored in Drive");
      }
    } else if (driveUrl) {
      finalDriveUrl = driveUrl;
      const sourceFileId = extractDriveFileId(driveUrl);
      finalFileId = sourceFileId;
      if (sourceFileId && destFolderId) {
        try {
          const { copiedFileId, webViewLink } = await copyDriveFile(sourceFileId, destFolderId, canonicalName);
          finalFileId = copiedFileId;
          finalDriveUrl = webViewLink;
          copied = true;
        } catch (copyErr) {
          console.warn("[attach-content] Drive copy failed (using original URL):", copyErr);
        }
      }
    }

    // ── Insert submission as already-approved (scripts are also auto-approved) ──
    const { data: insertData, error: insertError } = await admin
      .from("submissions")
      .insert({
        deal_id: deliverable.deal_id as string,
        deliverable_id: deliverableId,
        influencer_id: (deal.influencer_profile_id as string | null) ?? null,
        drive_url: finalDriveUrl,
        drive_file_id: finalFileId ?? null,
        file_name: canonicalName,
        caption,
        post_url: postUrl,
        content_type: "draft",
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        variant_label: variantLabel,
        is_script: isScript,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    const submissionId = insertData?.id as string;

    // ── Mark deliverable as completed (only for content, not scripts) ──────
    if (!isScript) {
      await admin.from("deliverables").update({
        status: "completed",
        live_date: new Date().toISOString().split("T")[0],
      }).eq("id", deliverableId);
    }

    // ── Slack + audit (fire-and-forget) ────────────────────────────────────
    const influencerName = deal.influencer_name ?? "Creator";
    const deliverableLabel = `${delivType} #${delivSeq}`;
    if (!isScript) {
      void notifyContentApproved({
        influencerName,
        deliverableLabel,
        adminName: "Admin (manual attach)",
        dealId: deliverable.deal_id as string,
      });
    }
    void logAuditEvent({
      actorId: user.id,
      entityType: "submission",
      entityId: submissionId,
      action: isScript ? "script_attached" : "content_attached_approved",
      after: {
        deliverableId,
        dealId: deliverable.deal_id,
        driveUrl: finalDriveUrl,
        canonicalName,
        copied,
        uploaded,
        variantLabel,
        isScript,
      },
    });

    return NextResponse.json({
      submissionId,
      driveUrl: finalDriveUrl,
      canonicalName,
      copied,
      uploaded,
      isScript,
    });
  } catch (error) {
    console.error("[attach-content] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to attach content" },
      { status: 500 },
    );
  }
}
