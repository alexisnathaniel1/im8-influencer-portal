/**
 * DELETE /api/submissions/[id]
 *
 * Removes a submission row (e.g. duplicates, test uploads). Admin-only.
 *
 * What we delete vs. keep:
 *  - The submissions row is hard-deleted.
 *  - The Drive file(s) are LEFT IN PLACE. Drive cleanup is intentional —
 *    reviewers may have already opened these in another tab, and we'd rather
 *    leak a duplicate than permanently lose content. The team can clean Drive
 *    manually if they want to.
 *  - Cascade: deliverable_comments link to deliverable, not submission, so
 *    they're untouched. submissions has no FK children we own.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit/log";

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

    return NextResponse.json({ ok: true, id: submissionId });
  } catch (error) {
    console.error("[submissions/DELETE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete submission" },
      { status: 500 },
    );
  }
}
