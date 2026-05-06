/**
 * Higher-level Drive folder orchestration for deals + deliverables.
 *
 * - `ensureDealFolder(admin, dealId)` — idempotent: returns the deal's contract
 *   folder ID, creating `IM8_NAME/Contract N/` if needed. Used by both the per-
 *   deal "Create Drive folder" button and the bulk-create-folders endpoint.
 *
 * - `getOrCreateDeliverableFolder(admin, deliverableId)` — idempotent: returns
 *   the deliverable's subfolder ID (e.g. `IGR_05`) inside the deal's contract
 *   folder, creating it on first use. Used by submission-attach flows so each
 *   deliverable's assets land in their own subfolder.
 *
 * Both helpers degrade gracefully — they return `null` if the underlying
 * Drive call fails, and callers fall back to the original URL or skip copy.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import {
  createSubFolder,
  createInfluencerFolder,
  extractFolderId,
} from "@/lib/google/drive";

type AdminClient = ReturnType<typeof createAdminClient>;

export type EnsureDealFolderResult =
  | { ok: true; folderId: string; alreadyLinked: boolean; partnerFolderId: string | null }
  | { ok: false; error: string };

/**
 * Idempotently ensure a deal has its `IM8_NAME/Contract N/` folder structure
 * in place and `deals.drive_folder_id` is populated. Safe to call repeatedly.
 */
export async function ensureDealFolder(
  admin: AdminClient,
  dealId: string,
): Promise<EnsureDealFolderResult> {
  const { data: deal, error: dealErr } = await admin
    .from("deals")
    .select("influencer_name, influencer_profile_id, drive_folder_id, contract_sequence")
    .eq("id", dealId)
    .single();

  if (dealErr || !deal) {
    return { ok: false, error: dealErr?.message || "Deal not found" };
  }

  // Already linked — nothing to do.
  if (deal.drive_folder_id) {
    return {
      ok: true,
      folderId: deal.drive_folder_id as string,
      alreadyLinked: true,
      partnerFolderId: null,
    };
  }

  if (!process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return { ok: false, error: "Drive not configured (GOOGLE_DRIVE_MASTER_FOLDER_ID missing)" };
  }

  try {
    const influencerName = (deal.influencer_name as string) ?? "Unknown";
    const contractSeq = (deal.contract_sequence as number | null) ?? 1;
    const contractLabel = `Contract ${contractSeq}`;

    // Resolve / create the partner-level (top) folder.
    let partnerFolderId: string | null = null;
    let creatorEmail = "";

    if (deal.influencer_profile_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("drive_folder_url, email")
        .eq("id", deal.influencer_profile_id)
        .single();
      creatorEmail = (profile?.email as string | null) ?? "";
      if (profile?.drive_folder_url) {
        partnerFolderId = extractFolderId(profile.drive_folder_url as string);
      }
    }

    if (!partnerFolderId) {
      const partnerFolderName = `IM8_${influencerName
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, "")
        .trim()
        .replace(/\s+/g, "_")}`;
      const newFolderUrl = await createInfluencerFolder(partnerFolderName, creatorEmail);
      partnerFolderId = extractFolderId(newFolderUrl);

      if (deal.influencer_profile_id && partnerFolderId) {
        await admin
          .from("profiles")
          .update({ drive_folder_url: newFolderUrl })
          .eq("id", deal.influencer_profile_id);
      }
    }

    if (!partnerFolderId) {
      return { ok: false, error: "Could not determine partner Drive folder" };
    }

    // Create the Contract N subfolder.
    const { folderId: contractFolderId } = await createSubFolder(
      partnerFolderId,
      contractLabel,
      creatorEmail || undefined,
    );

    await admin.from("deals").update({ drive_folder_id: contractFolderId }).eq("id", dealId);

    return { ok: true, folderId: contractFolderId, alreadyLinked: false, partnerFolderId };
  } catch (err) {
    console.error("[ensureDealFolder] failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Drive folder creation failed" };
  }
}

/**
 * Idempotently ensure a deliverable has its own subfolder
 * (e.g. `IGR_05/`) inside the deal's contract folder.
 *
 * Returns the folder ID, or `null` if the deal's contract folder is missing
 * (caller should fall back to the deal-level folder or skip the copy).
 */
export async function getOrCreateDeliverableFolder(
  admin: AdminClient,
  deliverableId: string,
): Promise<string | null> {
  const { data: deliverable } = await admin
    .from("deliverables")
    .select("id, deliverable_type, sequence, drive_folder_id, deal_id")
    .eq("id", deliverableId)
    .single();

  if (!deliverable) return null;

  if (deliverable.drive_folder_id) {
    return deliverable.drive_folder_id as string;
  }

  // Need the contract folder to nest under.
  const { data: deal } = await admin
    .from("deals")
    .select("drive_folder_id")
    .eq("id", deliverable.deal_id)
    .single();

  const contractFolderId = (deal?.drive_folder_id as string | null) ?? null;
  if (!contractFolderId) return null;

  // Folder name: `IGR_05`, `TIKTOK_01`, `YT_DEDICATED_01`
  const type = ((deliverable.deliverable_type as string | null) ?? "CONTENT")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toUpperCase();
  const seq = (deliverable.sequence as number | null) ?? 1;
  const folderName = `${type}_${String(seq).padStart(2, "0")}`;

  try {
    const { folderId } = await createSubFolder(contractFolderId, folderName);
    await admin.from("deliverables").update({ drive_folder_id: folderId }).eq("id", deliverableId);
    return folderId;
  } catch (err) {
    console.warn("[getOrCreateDeliverableFolder] subfolder create failed:", err);
    return null;
  }
}
