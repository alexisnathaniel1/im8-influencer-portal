/**
 * POST /api/admin/bulk-create-folders
 *
 * Loops every deal where drive_folder_id IS NULL (active statuses only) and
 * creates the IM8_NAME/Contract N/ structure for each, populating
 * deals.drive_folder_id along the way. Idempotent — safe to re-run.
 *
 * Concurrency capped at 4 to stay friendly with Drive API rate limits.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDealFolder } from "@/lib/drive/deal-folders";
import { ADMIN_ROLES } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit/log";

export const maxDuration = 300; // Drive folder creation can be slow at scale.

const ACTIVE_STATUSES = ["pending_approval", "approved", "contracted", "live"];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: deals, error: dealsErr } = await admin
    .from("deals")
    .select("id, influencer_name")
    .is("drive_folder_id", null)
    .in("status", ACTIVE_STATUSES);

  if (dealsErr) {
    return NextResponse.json({ error: dealsErr.message }, { status: 500 });
  }
  if (!deals || deals.length === 0) {
    return NextResponse.json({ created: 0, failed: 0, errors: [], total: 0 });
  }

  // Capture into a non-nullable local so the worker closure can index it cleanly.
  const dealsList = deals;

  // Concurrency-limited fan-out.
  const CONCURRENCY = 4;
  let created = 0;
  let failed = 0;
  const errors: Array<{ dealId: string; name: string; message: string }> = [];

  let cursor = 0;
  async function worker() {
    while (cursor < dealsList.length) {
      const i = cursor++;
      const deal = dealsList[i];
      const dealId = deal.id as string;
      const name = (deal.influencer_name as string | null) ?? "Unknown";
      const result = await ensureDealFolder(admin, dealId);
      if (result.ok) {
        created++;
      } else {
        failed++;
        errors.push({ dealId, name, message: result.error });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, dealsList.length) }, () => worker()));

  void logAuditEvent({
    actorId: user.id,
    entityType: "deal",
    entityId: "bulk",
    action: "bulk_create_drive_folders",
    after: { total: deals.length, created, failed },
  });

  return NextResponse.json({
    total: deals.length,
    created,
    failed,
    errors,
  });
}
