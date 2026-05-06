import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDriveFileId, extractFolderId, copyDriveFile } from "@/lib/google/drive";
import { notifyContentSubmitted } from "@/lib/slack/notify";
import { logAuditEvent } from "@/lib/audit/log";
import { ADMIN_ROLES } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Role check — admin / management / support only
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const {
      dealId,
      deliverableId,
      driveUrl,
      caption,
      postUrl,
      fileName: rawFileName,
    } = await request.json() as {
      dealId: string;
      deliverableId?: string;
      driveUrl: string;
      caption?: string;
      postUrl?: string;
      fileName?: string;
    };

    if (!dealId || !driveUrl) {
      return NextResponse.json({ error: "dealId and driveUrl are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Load deal
    const { data: deal } = await admin
      .from("deals")
      .select("influencer_name, influencer_profile_id, drive_folder_id, contract_sequence")
      .eq("id", dealId)
      .single();

    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    // 2. Load deliverable (if provided)
    let deliverableType: string | null = null;
    let deliverableSeq: number | null = null;
    if (deliverableId) {
      const { data: deliv } = await admin
        .from("deliverables")
        .select("deliverable_type, sequence")
        .eq("id", deliverableId)
        .single();
      if (deliv) {
        deliverableType = deliv.deliverable_type ?? null;
        deliverableSeq = (deliv.sequence as number | null) ?? null;
      }
    }

    // 3. Count existing submissions for this deliverable → draft number
    let draftNumber = 1;
    if (deliverableId) {
      const { count } = await admin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("deliverable_id", deliverableId);
      draftNumber = (count ?? 0) + 1;
    }

    // 4. Build canonical filename (same convention as upload-session route)
    const safeName = (deal.influencer_name ?? "creator")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();
    const contractSeq = (deal.contract_sequence as number | null) ?? 1;
    const delivLabel = deliverableType
      ? `${deliverableType.replace(/[^a-zA-Z0-9_]/g, "")}${deliverableSeq ?? ""}`.replace(/\s+/g, "")
      : "content";
    const canonicalName = `${safeName}_Contract${contractSeq}_${delivLabel}_DRAFT_${draftNumber}`;

    // 5. Extract file ID from the pasted Drive URL
    const sourceFileId = extractDriveFileId(driveUrl);

    // 6. Attempt to copy the file into the partner's Drive folder
    let finalDriveUrl = driveUrl;
    let finalFileId = sourceFileId;
    let copied = false;

    if (sourceFileId) {
      // Resolve destination folder: deal folder first, then influencer profile folder
      let destFolderId: string | null = (deal.drive_folder_id as string | null) ?? null;

      if (!destFolderId && deal.influencer_profile_id) {
        const { data: profRow } = await admin
          .from("profiles")
          .select("drive_folder_url")
          .eq("id", deal.influencer_profile_id as string)
          .single();
        if (profRow?.drive_folder_url) {
          destFolderId = extractFolderId(profRow.drive_folder_url as string);
        }
      }

      if (destFolderId) {
        try {
          const { copiedFileId, webViewLink } = await copyDriveFile(
            sourceFileId,
            destFolderId,
            canonicalName,
          );
          finalFileId = copiedFileId;
          finalDriveUrl = webViewLink;
          copied = true;
        } catch (copyErr) {
          // Degrade gracefully — log the warning, continue with original URL
          console.warn("[submissions/log] Drive copy failed (using original URL):", copyErr);
        }
      }
    }

    const fileName = rawFileName || canonicalName;

    // 7. Insert submission
    const { data: insertData, error: insertError } = await admin
      .from("submissions")
      .insert({
        deal_id: dealId,
        deliverable_id: deliverableId ?? null,
        influencer_id: (deal.influencer_profile_id as string | null) ?? null,
        drive_url: finalDriveUrl,
        drive_file_id: finalFileId ?? null,
        file_name: fileName,
        caption: typeof caption === "string" ? caption : null,
        post_url: typeof postUrl === "string" && postUrl ? postUrl : null,
        content_type: "draft",
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const submissionId = insertData?.id;

    // 8. Slack notification (fire-and-forget)
    const influencerName = deal.influencer_name ?? "Creator";
    const deliverableLabel = deliverableType
      ? deliverableSeq ? `${deliverableType} #${deliverableSeq}` : deliverableType
      : "Content";
    notifyContentSubmitted({
      influencerName,
      deliverableLabel,
      draftNumber,
      dealId,
    });

    // 9. Audit log
    if (submissionId) {
      void logAuditEvent({
        actorId: user.id,
        entityType: "submission",
        entityId: submissionId,
        action: "submission_logged_manually",
        after: { dealId, deliverableId: deliverableId ?? null, driveUrl: finalDriveUrl, canonicalName, copied },
      });
    }

    return NextResponse.json({
      id: submissionId,
      driveUrl: finalDriveUrl,
      canonicalName,
      copied,
    });
  } catch (error) {
    console.error("[submissions/log] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to log submission" },
      { status: 500 },
    );
  }
}
