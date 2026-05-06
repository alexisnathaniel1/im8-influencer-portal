import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit/log";
import { DELIVERABLE_PLATFORM_MAP, BINARY_DELIVERABLE_CODES } from "@/lib/deliverables";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = [
    "influencer_name", "influencer_email", "agency_name", "platform_primary",
    "deliverables", "monthly_rate_cents", "total_months", "campaign_start",
    "campaign_end", "rationale", "outreach_thread_url", "status", "rejection_reason",
    "instagram_handle", "tiktok_handle", "youtube_handle",
    "is_gifted", "gifted_product", "gifted_quantity", "product_sent_at", "needs_approval",
    "niche_tags", "follower_count",
    "contract_url", "payment_terms", "contract_requirements", "usage_rights_months",
    "discount_code", "affiliate_link", "currency_code",
  ];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const admin = createAdminClient();

  const { data: before } = await admin
    .from("deals")
    .select("status, deliverables, influencer_name, platform_primary, campaign_start, campaign_end, total_months")
    .eq("id", id)
    .single();

  // Auto-populate campaign_start/end when a deal becomes contracted or live and dates aren't set.
  // This avoids partner-tracker / roster rows showing "—" for the campaign timeline.
  {
    const newStatus = updates.status as string | undefined;
    const becameActive =
      newStatus && ["contracted", "live"].includes(newStatus) && before?.status !== newStatus;
    if (becameActive) {
      const months =
        (updates.total_months as number | undefined) ??
        (before?.total_months as number | null) ??
        3;
      const existingStart = (updates.campaign_start as string | undefined) ?? (before?.campaign_start as string | null);
      const existingEnd = (updates.campaign_end as string | undefined) ?? (before?.campaign_end as string | null);

      if (!existingStart) {
        updates.campaign_start = new Date().toISOString().split("T")[0];
      }
      if (!existingEnd) {
        const start = new Date((updates.campaign_start as string) ?? existingStart!);
        start.setMonth(start.getMonth() + months);
        updates.campaign_end = start.toISOString().split("T")[0];
      }
    }
  }

  const { error } = await admin.from("deals").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auto-populate tracker rows as soon as deliverables are saved on a deal —
  // regardless of deal status, so brief links work even for pending/negotiating deals.
  // WHITELIST/PAID_AD/RAW_FOOTAGE/LINK_BIO are rights grants, not schedulable posts — skip them.
  {
    const effectiveDeliverables =
      ((updates.deliverables as Array<{ code: string; count: number }> | undefined) ??
       (before?.deliverables as Array<{ code: string; count: number }> | undefined) ?? [])
        // Exclude rights/extras — not schedulable content deliverables
        .filter(item => item && item.code && item.count > 0
          && !BINARY_DELIVERABLE_CODES.has(item.code));

    if (effectiveDeliverables.length > 0) {
      const PLATFORM_MAP = DELIVERABLE_PLATFORM_MAP;

      // Fetch existing deliverable rows so we can insert only MISSING ones.
      // This handles the case where deliverables are added to the contract after
      // the initial auto-populate (e.g. deal started with IGR×1, then updated to IGR×3).
      const { data: existingRows } = await admin
        .from("deliverables")
        .select("deliverable_type, sequence")
        .eq("deal_id", id);

      const existingKeys = new Set(
        (existingRows ?? []).map(d => `${d.deliverable_type}_${d.sequence ?? 1}`)
      );

      const rows = effectiveDeliverables.flatMap(item =>
        Array.from({ length: item.count }, (_, i) => {
          const seq = i + 1;
          // Skip rows that already exist in the tracker
          if (existingKeys.has(`${item.code}_${seq}`)) return null;
          return {
            deal_id: id,
            deliverable_type: item.code,
            platform: PLATFORM_MAP[item.code] ?? (before?.platform_primary ?? "instagram"),
            is_story: item.code === "IGS",
            sequence: seq,
            title: `${before?.influencer_name ?? ""} — ${item.code} #${seq}`,
          };
        }).filter((r): r is NonNullable<typeof r> => r !== null)
      );

      if (rows.length > 0) {
        const { error: insertErr } = await admin.from("deliverables").insert(rows);
        if (insertErr) {
          if (insertErr.message.includes("sequence")) {
            // sequence column not migrated yet — retry without it
            console.warn("[deals/patch] sequence column absent, retrying without it");
            const rowsNoSeq = rows.map(({ sequence: _seq, ...rest }) => rest);
            const { error: insertErr2 } = await admin.from("deliverables").insert(rowsNoSeq);
            if (insertErr2) {
              console.error("[deals/patch] auto-populate retry failed:", insertErr2.message);
            } else {
              console.log("[deals/patch] auto-populated", rowsNoSeq.length, "deliverable rows (no sequence) for deal", id);
            }
          } else {
            console.error("[deals/patch] deliverables auto-populate failed:", insertErr.message, "deal_id:", id, "rows:", rows.length);
          }
        } else {
          console.log("[deals/patch] auto-populated", rows.length, "new deliverable rows for deal", id);
        }
      } else {
        console.log("[deals/patch] no new deliverable rows needed for deal", id);
      }
    }
  }

  await logAuditEvent({
    actorId: user.id,
    entityType: "deal",
    entityId: id,
    action: updates.status ? `status_changed_to_${updates.status}` : "updated",
    after: updates as Record<string, unknown>,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: actorProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!actorProfile || !["admin", "management"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("deals").delete().eq("id", id);
  if (error) {
    console.error("[deals/delete]", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
