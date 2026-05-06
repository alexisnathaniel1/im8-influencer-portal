/**
 * POST /api/admin/backfill-deliverable-status
 *
 * One-shot backfill: syncs deliverable.status to match the submission pipeline
 * for all rows that were logged before the auto-sync logic existed.
 *
 *  pending submission       → deliverable → submitted
 *  revision_requested sub   → deliverable → in_progress
 *
 * Admin / management only. Safe to call multiple times (idempotent).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/permissions";

export async function POST() {
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

  // 1. Find all deliverable IDs that have at least one non-script pending submission
  const { data: pendingSubs } = await admin
    .from("submissions")
    .select("deliverable_id")
    .eq("status", "pending")
    .eq("is_script", false)
    .not("deliverable_id", "is", null);

  // 2. Find all deliverable IDs that have revision_requested submissions
  const { data: revisionSubs } = await admin
    .from("submissions")
    .select("deliverable_id")
    .eq("status", "revision_requested")
    .eq("is_script", false)
    .not("deliverable_id", "is", null);

  const pendingDeliverableIds = [
    ...new Set((pendingSubs ?? []).map(s => s.deliverable_id as string)),
  ];
  const revisionDeliverableIds = [
    ...new Set((revisionSubs ?? []).map(s => s.deliverable_id as string)),
  ];

  let submittedCount = 0;
  let inProgressCount = 0;

  // 3. Flip pending deliverables → submitted
  if (pendingDeliverableIds.length > 0) {
    const { data: updated, error } = await admin
      .from("deliverables")
      .update({ status: "submitted" })
      .in("id", pendingDeliverableIds)
      .in("status", ["pending", "in_progress"])   // only update if not already further along
      .select("id");
    if (error) console.error("[backfill] pending→submitted failed:", error);
    submittedCount = updated?.length ?? 0;
  }

  // 4. Flip revision deliverables → in_progress (if still stuck at pending)
  if (revisionDeliverableIds.length > 0) {
    const { data: updated, error } = await admin
      .from("deliverables")
      .update({ status: "in_progress" })
      .in("id", revisionDeliverableIds)
      .eq("status", "pending")
      .select("id");
    if (error) console.error("[backfill] pending→in_progress failed:", error);
    inProgressCount = updated?.length ?? 0;
  }

  return NextResponse.json({
    ok: true,
    submittedCount,
    inProgressCount,
    message: `Updated ${submittedCount} deliverable(s) → submitted, ${inProgressCount} → in_progress`,
  });
}
