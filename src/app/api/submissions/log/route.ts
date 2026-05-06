/**
 * POST /api/submissions/log
 *
 * Log received content as a single submission with one or more assets.
 * One delivery from a creator can ship as multiple assets (Rose Harvey's
 * IGR #5 came as 7 files: 3 full reels + 3 hooks + 1 body). All of those
 * roll up into ONE submission card in the review queue.
 *
 * Payload shape:
 *   {
 *     dealId, deliverableId?, caption?, postUrl?, comment?,
 *     assets: [
 *       { asset_type, drive_url, label? },  // first = primary
 *       ...
 *     ]
 *   }
 *
 * Each asset of type !== "drive_folder" is copied into the deliverable's
 * Drive subfolder with a canonical filename. Drive Folder assets keep their
 * original URL (we don't clone folders).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDriveFileId, extractFolderId, copyDriveFile } from "@/lib/google/drive";
import { getOrCreateDeliverableFolder } from "@/lib/drive/deal-folders";
import { notifyContentSubmitted } from "@/lib/slack/notify";
import { logAuditEvent } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES } from "@/lib/permissions";
import { assetSlug, assetLabel, isAssetType, type AssetType, type VariantAsset } from "@/lib/submissions/asset-types";

interface AssetInput {
  asset_type: AssetType;
  drive_url: string;
  label?: string | null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      dealId: string;
      deliverableId?: string;
      caption?: string;
      postUrl?: string;
      comment?: string;
      assets: AssetInput[];
      // Legacy single-asset shape — accepted for safety, mapped to assets[0].
      driveUrl?: string;
      variantLabel?: string;
      isScript?: boolean;
    };

    const { dealId, deliverableId, caption, postUrl, comment } = body;

    // Normalize input: prefer the new assets[] array; fall back to legacy fields.
    let assets: AssetInput[] = Array.isArray(body.assets) ? body.assets : [];
    if (assets.length === 0 && body.driveUrl) {
      assets = [{
        asset_type: body.isScript ? "script" : "full_reel",
        drive_url: body.driveUrl,
        label: body.variantLabel ?? null,
      }];
    }

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }
    if (assets.length === 0) {
      return NextResponse.json({ error: "At least one asset is required" }, { status: 400 });
    }
    for (const a of assets) {
      if (!a.drive_url) return NextResponse.json({ error: "Every asset needs a Drive URL" }, { status: 400 });
      if (!isAssetType(a.asset_type)) {
        return NextResponse.json({ error: `Unknown asset type: ${a.asset_type}` }, { status: 400 });
      }
    }

    const admin = createAdminClient();

    // 1. Load deal
    const { data: deal } = await admin
      .from("deals")
      .select("influencer_name, influencer_profile_id, drive_folder_id, contract_sequence")
      .eq("id", dealId)
      .single();
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    // 2. Load deliverable (optional)
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

    // 3. Resolve destination folder once. Drive Folder assets are skipped during
    // the copy loop so the failure mode for folders ≠ failure for files.
    let destFolderId: string | null = null;
    if (deliverableId) {
      destFolderId = await getOrCreateDeliverableFolder(admin, deliverableId);
    }
    if (!destFolderId) {
      destFolderId = (deal.drive_folder_id as string | null) ?? null;
    }
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

    // 4. Compute draft sequence number for this deliverable. Scripts get their
    // own counter (SCRIPT_1, SCRIPT_2, …); regular content uses DRAFT_N.
    // Sequence is per-submission, not per-asset — adding 7 hooks under one
    // submission still counts as Draft 1.
    const primaryIsScript = assets[0].asset_type === "script";
    let sequenceNumber = 1;
    if (deliverableId) {
      const { count } = await admin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("deliverable_id", deliverableId)
        .eq("is_script", primaryIsScript);
      sequenceNumber = (count ?? 0) + 1;
    }

    // 5. Helpers for canonical filename + Drive copy
    const safeName = (deal.influencer_name ?? "creator")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();
    const contractSeq = (deal.contract_sequence as number | null) ?? 1;
    const delivLabel = deliverableType
      ? `${deliverableType.replace(/[^a-zA-Z0-9_]/g, "")}${deliverableSeq ?? ""}`
      : "content";

    function buildName(asset: AssetInput, indexWithinType: number): string {
      // e.g. rose_harvey_Contract1_IGR05_Hook1_DRAFT_3
      const slug = assetSlug(asset.asset_type);
      const slugWithIndex = indexWithinType > 1 ? `${slug}${indexWithinType}` : slug;
      const labelSlug = asset.label
        ? asset.label.replace(/[^a-zA-Z0-9]/g, "")
        : null;
      const variantPiece = labelSlug || slugWithIndex;
      const suffix = primaryIsScript ? `SCRIPT_${sequenceNumber}` : `DRAFT_${sequenceNumber}`;
      return [safeName, `Contract${contractSeq}`, delivLabel, variantPiece, suffix]
        .filter(Boolean)
        .join("_");
    }

    /** Copy a single asset's source file into the deliverable folder. */
    async function processAsset(
      asset: AssetInput,
      indexWithinType: number,
    ): Promise<{ drive_url: string; drive_file_id: string | null; file_name: string; copied: boolean }> {
      const canonicalName = buildName(asset, indexWithinType);

      // Drive Folder assets aren't copied — we just keep the URL.
      if (asset.asset_type === "drive_folder") {
        return {
          drive_url: asset.drive_url,
          drive_file_id: null,
          file_name: canonicalName,
          copied: false,
        };
      }

      const sourceFileId = extractDriveFileId(asset.drive_url);
      if (!sourceFileId || !destFolderId) {
        return {
          drive_url: asset.drive_url,
          drive_file_id: sourceFileId ?? null,
          file_name: canonicalName,
          copied: false,
        };
      }
      try {
        const { copiedFileId, webViewLink } = await copyDriveFile(
          sourceFileId,
          destFolderId,
          canonicalName,
        );
        return {
          drive_url: webViewLink,
          drive_file_id: copiedFileId,
          file_name: canonicalName,
          copied: true,
        };
      } catch (err) {
        console.warn("[submissions/log] Drive copy failed for", asset.asset_type, "—", err);
        return {
          drive_url: asset.drive_url,
          drive_file_id: sourceFileId,
          file_name: canonicalName,
          copied: false,
        };
      }
    }

    // 6. Process every asset. Track per-type counters so multiple Hooks
    // become Hook1, Hook2, Hook3 in the filename.
    const typeCounts: Partial<Record<AssetType, number>> = {};
    const processed: Array<{
      asset_type: AssetType;
      label: string | null;
      drive_url: string;
      drive_file_id: string | null;
      file_name: string;
      copied: boolean;
    }> = [];

    for (const asset of assets) {
      typeCounts[asset.asset_type] = (typeCounts[asset.asset_type] ?? 0) + 1;
      const idx = typeCounts[asset.asset_type] ?? 1;
      const result = await processAsset(asset, idx);
      processed.push({
        asset_type: asset.asset_type,
        label: asset.label?.trim() || null,
        ...result,
      });
    }

    const primary = processed[0];
    const additionalVariants: VariantAsset[] = processed.slice(1).map((p) => ({
      asset_type: p.asset_type,
      drive_url: p.drive_url,
      drive_file_id: p.drive_file_id,
      file_name: p.file_name,
      label: p.label,
    }));

    // 7. Insert the submission row.
    const insertPayload: Record<string, unknown> = {
      deal_id: dealId,
      deliverable_id: deliverableId ?? null,
      influencer_id: (deal.influencer_profile_id as string | null) ?? null,
      drive_url: primary.drive_url,
      drive_file_id: primary.drive_file_id,
      file_name: primary.file_name,
      caption: typeof caption === "string" && caption.trim() ? caption : null,
      post_url: typeof postUrl === "string" && postUrl.trim() ? postUrl : null,
      content_type: "draft",
      status: "pending",
      variant_label: primary.label || assetLabel(primary.asset_type),
      is_script: primaryIsScript,
      variants: additionalVariants,
    };

    const { data: insertData, error: insertError } = await admin
      .from("submissions")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    const submissionId = insertData?.id as string;

    // 8. Update the deliverable: flip status → submitted and auto-assign PIC.
    // Scripts don't enter the review queue so only do this for real content.
    if (deliverableId && !primaryIsScript) {
      void admin
        .from("deliverables")
        .update({
          status: "submitted",
          // Set PIC to whoever logged the content (only fill if currently blank)
          assigned_pic: user.id,
        })
        .eq("id", deliverableId)
        .then(({ error }) => {
          if (error) console.warn("[submissions/log] deliverable update failed", error);
        });
    }

    // 8b. Optional admin note → deliverable_comments (internal-only by default).
    if (comment && comment.trim() && deliverableId) {
      await admin.from("deliverable_comments").insert({
        deliverable_id: deliverableId,
        author_id: user.id,
        author_display_name: profile.full_name ?? "Admin",
        body: comment.trim(),
        visible_to_partner: false,
      });
    }

    // 9. Slack notification — one ping per submission, regardless of asset count.
    const influencerName = deal.influencer_name ?? "Creator";
    const deliverableLabel = deliverableType
      ? deliverableSeq ? `${deliverableType} #${deliverableSeq}` : deliverableType
      : "Content";
    notifyContentSubmitted({
      influencerName,
      deliverableLabel,
      draftNumber: sequenceNumber,
      dealId,
    });

    // 10. Audit log
    void logAuditEvent({
      actorId: user.id,
      entityType: "submission",
      entityId: submissionId,
      action: primaryIsScript ? "script_logged_manually" : "submission_logged_manually",
      after: {
        dealId,
        deliverableId: deliverableId ?? null,
        assetCount: processed.length,
        assets: processed.map((p) => ({
          asset_type: p.asset_type,
          label: p.label,
          file_name: p.file_name,
          copied: p.copied,
        })),
        primary: {
          drive_url: primary.drive_url,
          file_name: primary.file_name,
        },
      },
    });

    // Bust deliverables page cache so amber "Review →" badge appears immediately
    if (!primaryIsScript) revalidatePath("/admin/deliverables");

    return NextResponse.json({
      id: submissionId,
      driveUrl: primary.drive_url,
      canonicalName: primary.file_name,
      copied: primary.copied,
      assetCount: processed.length,
      copiedCount: processed.filter((p) => p.copied).length,
      isScript: primaryIsScript,
    });
  } catch (error) {
    console.error("[submissions/log] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to log submission" },
      { status: 500 },
    );
  }
}
