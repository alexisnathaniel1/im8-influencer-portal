/**
 * PATCH /api/submissions/[id]  — edit submission metadata (admin-only)
 * DELETE /api/submissions/[id] — hard-delete + rename Drive files (admin-only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { renameDriveFile } from "@/lib/google/drive";
import type { VariantAsset } from "@/lib/submissions/asset-types";

/** ------------------------------------------------------------------ PATCH */
export async function PATCH(
  request: NextRequest,
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

    const body = await request.json() as {
      deliverable_id?: string | null;
      variant_label?: string | null;
      caption?: string | null;
      drive_url?: string | null;
      draft_num?: number;
    };

    // Only allow the fields we explicitly support editing.
    const allowed = ["deliverable_id", "variant_label", "caption", "drive_url"] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        updates[key] = body[key] ?? null;
      }
    }

    const admin = createAdminClient();

    // Snapshot before for audit log.
    const { data: before } = await admin
      .from("submissions")
      .select("deliverable_id, variant_label, caption, drive_url, file_name, drive_file_id")
      .eq("id", submissionId)
      .single();

    if (!before) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Draft number → rewrite file_name + rename Drive file
    if (body.draft_num != null && typeof body.draft_num === "number" && body.draft_num > 0) {
      const currentName = (before.file_name as string | null) ?? "";
      const isScript = /_SCRIPT_\d+$/.test(currentName);
      const prefix = isScript ? "SCRIPT" : "DRAFT";
      const newFileName = currentName.match(/_(DRAFT|SCRIPT)_\d+$/)
        ? currentName.replace(/_(DRAFT|SCRIPT)_\d+$/, `_${prefix}_${body.draft_num}`)
        : `${currentName}_${prefix}_${body.draft_num}`;

      if (newFileName !== currentName) {
        updates["file_name"] = newFileName;
        // Fire-and-forget Drive rename so the file reflects the corrected number
        if (before.drive_file_id) {
          void renameDriveFile(before.drive_file_id as string, newFileName).catch((e) =>
            console.warn("[submissions/PATCH] Drive rename for draft_num failed", e)
          );
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("submissions")
      .update(updates)
      .eq("id", submissionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    void logAuditEvent({
      actorId: user.id,
      entityType: "submission",
      entityId: submissionId,
      action: "submission_edited",
      before,
      after: updates,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[submissions/PATCH] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update submission" },
      { status: 500 },
    );
  }
}

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

    // Snapshot the row before delete, with deal + deliverable names so the
    // audit log remains readable after the submission is gone.
    const { data: before } = await admin
      .from("submissions")
      .select(`
        id, deal_id, deliverable_id, status, file_name, drive_url, drive_file_id,
        variants, is_script, variant_label, submitted_at,
        deal:deal_id(influencer_name),
        deliverable:deliverable_id(deliverable_type, sequence)
      `)
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

    // Build a flat enriched snapshot — the joined deal/deliverable rows are
    // removed after extraction so the stored JSON stays clean.
    const dealSnap = Array.isArray(before.deal) ? before.deal[0] : before.deal;
    const delivSnap = Array.isArray(before.deliverable) ? before.deliverable[0] : before.deliverable;
    const { deal: _d, deliverable: _dv, ...rest } = before as typeof before & { deal?: unknown; deliverable?: unknown };
    const enrichedBefore = {
      ...rest,
      influencer_name: (dealSnap as { influencer_name?: string } | null)?.influencer_name ?? null,
      deliverable_type: (delivSnap as { deliverable_type?: string } | null)?.deliverable_type ?? null,
      deliverable_sequence: (delivSnap as { sequence?: number } | null)?.sequence ?? null,
    };

    void logAuditEvent({
      actorId: user.id,
      entityType: "submission",
      entityId: submissionId,
      action: "submission_deleted",
      before: enrichedBefore,
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
