/**
 * POST /api/submissions/[id]/rename-revision
 *
 * Renames the Drive file(s) attached to a submission to include "_NEED_REVISION"
 * so reviewers can see the status at a glance in Drive.
 *
 * Fire-and-forget from the review UI — non-blocking; a rename failure never
 * blocks the revision request itself.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renameDriveFile } from "@/lib/google/drive";
import type { VariantAsset } from "@/lib/submissions/asset-types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: sub } = await admin
      .from("submissions")
      .select("drive_file_id, file_name, status, variants")
      .eq("id", id)
      .single();

    if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    if (sub.status !== "revision_requested") {
      return NextResponse.json({ ok: true, renamed: false, reason: "not_revision_requested" });
    }

    const filesToRename: Array<{ fileId: string; baseName: string }> = [];

    if (sub.drive_file_id) {
      filesToRename.push({
        fileId: sub.drive_file_id as string,
        baseName: (sub.file_name as string | null) ?? "content",
      });
    }

    const variants = Array.isArray(sub.variants) ? (sub.variants as VariantAsset[]) : [];
    for (const v of variants) {
      if (v.drive_file_id) {
        filesToRename.push({ fileId: v.drive_file_id, baseName: v.file_name ?? "content" });
      }
    }

    if (filesToRename.length === 0) {
      return NextResponse.json({ ok: true, renamed: false, reason: "no_file_ids" });
    }

    const results: Array<{ fileId: string; result: unknown }> = [];
    for (const { fileId, baseName } of filesToRename) {
      // Strip any existing status suffix, then append _NEED_REVISION
      const cleaned = baseName
        .replace(/_APPROVED$/, "")
        .replace(/_DELETED$/, "")
        .replace(/^DELETED_/, "")
        .replace(/_NEED_REVISION$/, "")
        .replace(/_DRAFT_\d+$/, "")
        .replace(/_\d{10,}$/, "");
      const newName = `${cleaned}_NEED_REVISION`;
      try {
        const r = await renameDriveFile(fileId, newName);

        // Persist updated name for the primary file
        if (r.renamed && fileId === sub.drive_file_id) {
          await admin
            .from("submissions")
            .update({ file_name: newName })
            .eq("id", id);
        }

        results.push({ fileId, result: r });
      } catch (err) {
        console.warn("[rename-revision] Drive rename failed for", fileId, err);
        results.push({ fileId, result: { renamed: false, reason: String(err) } });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[rename-revision]", err);
    // Non-fatal — return ok so the revision itself is never blocked
    return NextResponse.json({ ok: true, renamed: false, reason: String(err) });
  }
}
