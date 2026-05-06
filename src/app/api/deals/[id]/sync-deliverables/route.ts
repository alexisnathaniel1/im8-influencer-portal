import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DELIVERABLE_PLATFORM_MAP, BINARY_DELIVERABLE_CODES } from "@/lib/deliverables";

// Skip rights/extras when seeding tracker rows — they're grants, not posts.
const SKIP_CODES = BINARY_DELIVERABLE_CODES;
const PLATFORM_MAP = DELIVERABLE_PLATFORM_MAP;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: deal, error: dealErr } = await admin
    .from("deals")
    .select("deliverables, influencer_name, platform_primary")
    .eq("id", id)
    .single();

  if (dealErr || !deal) {
    return NextResponse.json({ error: dealErr?.message || "Deal not found" }, { status: 404 });
  }

  const dealDeliverables = ((deal.deliverables as Array<{ code: string; count: number }> | null) ?? [])
    .filter(item => item?.code && item.count > 0 && !SKIP_CODES.has(item.code));

  if (dealDeliverables.length === 0) {
    return NextResponse.json({ created: 0, message: "No schedulable deliverables on this deal" });
  }

  // Find which type+sequence rows already exist
  const { data: existingRows } = await admin
    .from("deliverables")
    .select("deliverable_type, sequence")
    .eq("deal_id", id);

  const existingKeys = new Set(
    (existingRows ?? []).map(d => `${d.deliverable_type}_${d.sequence ?? 1}`)
  );

  const rows = dealDeliverables.flatMap(item =>
    Array.from({ length: item.count }, (_, i) => {
      const seq = i + 1;
      if (existingKeys.has(`${item.code}_${seq}`)) return null;
      return {
        deal_id: id,
        deliverable_type: item.code,
        platform: PLATFORM_MAP[item.code] ?? ((deal.platform_primary as string) ?? "instagram"),
        is_story: item.code === "IGS",
        sequence: seq,
        title: `${(deal.influencer_name as string) ?? ""} — ${item.code} #${seq}`,
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null)
  );

  if (rows.length === 0) {
    return NextResponse.json({ created: 0, message: "All deliverable rows already exist" });
  }

  const { error: insertErr } = await admin.from("deliverables").insert(rows);
  if (insertErr) {
    console.error("[sync-deliverables]", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ created: rows.length });
}
