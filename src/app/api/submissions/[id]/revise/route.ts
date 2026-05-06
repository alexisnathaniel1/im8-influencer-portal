/**
 * POST /api/submissions/[id]/revise
 *
 * Moves the full revision-request flow server-side so it is always audit-logged.
 * Accessible to admin, management, and support roles.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { renameDriveFile } from "@/lib/google/drive";

export async function POST(
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
      feedback?: string | null;
      feedback_caption?: string | null;
      reviewedBy?: string;
    };
    const actorId = body.reviewedBy ?? user.id;

    const admin = createAdminClient();

    // Rich context snapshot
    const { data: sub } = await admin
      .from("submissions")
      .select(`
        status, file_name, drive_file_id, variant_label, is_script, deal_id, deliverable_id,
        deal:deal_id(influencer_name),
        deliverable:deliverable_id(deliverable_type, sequence)
      `)
      .eq("id", submissionId)
      .single();

    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const deal = sub.deal as { influencer_name?: string } | null;
    const deliverable = sub.deliverable as { deliverable_type?: string; sequence?: number | null } | null;

    // Update submission
    const { error: updateError } = await admin
      .from("submissions")
      .update({
        status: "revision_requested",
        feedback: body.feedback ?? null,
        feedback_caption: body.feedback_caption ?? null,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update deliverable if linked → in_progress
    if (sub.deliverable_id) {
      void admin
        .from("deliverables")
        .update({ status: "in_progress" })
        .eq("id", sub.deliverable_id)
        .then(({ error }) => {
          if (error) console.warn("[revise] deliverable update failed", error);
        });
    }

    // Audit log
    void logAuditEvent({
      actorId,
      entityType: "submission",
      entityId: submissionId,
      action: "submission_revision_requested",
      before: {
        status: "pending",
        influencer_name: deal?.influencer_name ?? null,
        deliverable_type: deliverable?.deliverable_type ?? null,
        deliverable_sequence: deliverable?.sequence ?? null,
        file_name: sub.file_name,
        drive_file_id: sub.drive_file_id,
        deal_id: sub.deal_id,
        deliverable_id: sub.deliverable_id,
        variant_label: sub.variant_label,
      },
      after: {
        status: "revision_requested",
        feedback: body.feedback ?? null,
        feedback_caption: body.feedback_caption ?? null,
      },
    });

    // Fire-and-forget Drive rename → _NEED_REVISION
    if (sub.drive_file_id) {
      const cleaned = (sub.file_name ?? "content")
        .replace(/_APPROVED$/, "")
        .replace(/_NEED_REVISION$/, "")
        .replace(/_DRAFT_\d+$/, "")
        .replace(/_SCRIPT_\d+$/, "")
        .replace(/_\d{10,}$/, "");
      const newName = `${cleaned}_NEED_REVISION`;
      void renameDriveFile(sub.drive_file_id as string, newName).then(async (result) => {
        if (result.renamed) {
          await admin
            .from("submissions")
            .update({ file_name: newName })
            .eq("id", submissionId);
        }
      }).catch((err) => console.warn("[revise] Drive rename failed", err));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[revise] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to request revision" },
      { status: 500 },
    );
  }
}
