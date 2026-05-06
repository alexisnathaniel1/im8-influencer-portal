/**
 * POST /api/submissions/[id]/undo
 *
 * Resets an approved or revision_requested submission back to pending.
 * Accessible to admin, management, and support roles.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { renameDriveFile } from "@/lib/google/drive";
import { revalidatePath } from "next/cache";

export async function POST(
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

    const { data: sub } = await admin
      .from("submissions")
      .select("status, file_name, drive_file_id, deal_id, deliverable_id")
      .eq("id", submissionId)
      .single();

    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // No-op if already pending or some other status
    if (sub.status !== "approved" && sub.status !== "revision_requested") {
      return NextResponse.json({ ok: true, noOp: true });
    }

    const previousStatus = sub.status as string;

    // Reset submission to pending
    const { error: updateError } = await admin
      .from("submissions")
      .update({
        status: "pending",
        feedback: null,
        feedback_caption: null,
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq("id", submissionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Reset deliverable to in_progress
    if (sub.deliverable_id) {
      void admin
        .from("deliverables")
        .update({ status: "in_progress" })
        .eq("id", sub.deliverable_id)
        .then(({ error }) => {
          if (error) console.warn("[undo] deliverable update failed", error);
        });
    }

    // Drive rename — restore the original clean name
    const cleanName = (sub.file_name ?? "content")
      .replace(/_APPROVED$/, "")
      .replace(/_NEED_REVISION$/, "")
      .replace(/^DELETED_/, "");
    if (sub.drive_file_id && cleanName !== sub.file_name) {
      void renameDriveFile(sub.drive_file_id as string, cleanName).catch(console.warn);
    }

    // Audit log
    void logAuditEvent({
      actorId: user.id,
      entityType: "submission",
      entityId: submissionId,
      action: "submission_undone",
      before: { status: previousStatus },
      after: { status: "pending" },
    });

    revalidatePath("/admin/deliverables");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[undo] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to undo submission" },
      { status: 500 },
    );
  }
}
