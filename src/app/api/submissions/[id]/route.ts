/**
 * DELETE /api/submissions/[id]
 *
 * Removes a submission row (e.g. duplicates, test uploads). Admin-only.
 *
 * What we delete vs. keep:
 *  - The submissions row is hard-deleted.
 *  - The Drive file(s) are renamed with a "DELETED_" prefix so reviewers
 *    can see the status at a glance in Drive without losing the actual file.
 *  - Cascade: deliverable_comments link to deliverable, not submission, so
 *    they're untouched. submissions has no FK children we own.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { renameDriveFile } from "@/lib/google/drive";
import type { VariantAsset } from "@/lib/submissions/asset-types";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: submissionId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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

    // Snapshot the row before delete so the audit log captures what was lost.
    const { data: before } = await admin
      .from("submissions")
      .select("id, deal_id, deliverable_id, status, file_name, drive_url, drive_file_id, variants, is_script, variant_label, submitted_at")
      .eq("id", submissionId)
      .single();

    if (!before) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const { error: deleteError } = await admin
      .from("submissions")
      .delete()
      .eq("id", submissionId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    void logAuditEvent({
      actorId: user.id,
      entityType: "submission",
      entityId: submissionId,
      action: "submission_deleted",
      before,
    });

    // Rename Drive files to prefix with DELETED_ so the team can see the
    // status at a glance in Drive without actually losing the file.
    void renameDriveFilesDeleted(before);

    return NextResponse.json({ ok: true, id: submissionId });
  } catch (error) {
    console.error("[submissions/DELETE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete submission" },
      { status: 500 },
    );
  }
}

/** Fire-and-forget: rename every Drive file attached to a deleted submission. */
async function renameDriveFilesDeleted(sub: {
  drive_file_id?: string | null;
  file_name?: string | null;
  variants?: unknown;
}) {
  const filesToRename: Array<{ fileId: string; baseName: string }> = [];

  if (sub.drive_file_id) {
    filesToRename.push({
      fileId: sub.drive_file_id,
      baseName: sub.file_name ?? "content",
    });
  }

  const variants = Array.isArray(sub.variants) ? (sub.variants as VariantAsset[]) : [];
  for (const v of variants) {
    if (v.drive_file_id) {
      filesToRename.push({ fileId: v.drive_file_id, baseName: v.file_name ?? "content" });
    }
  }

  for (const { fileId, baseName } of filesToRename) {
    // Strip any existing status suffix, then prepend DELETED_
    const cleaned = baseName
      .replace(/_APPROVED$/, "")
      .replace(/_NEED_REVISION$/, "");
    const newName = `DELETED_${cleaned}`;
    try {
      await renameDriveFile(fileId, newName);
    } catch (err) {
      console.warn("[submissions/DELETE] Drive rename failed for", fileId, err);
    }
  }
}
