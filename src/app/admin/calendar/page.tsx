import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import CalendarGrid from "./calendar-grid";

// Serialize a Date to YYYY-MM-DD in local time
function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  // Parse ?month=YYYY-MM, default to current month
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth(); // 0-indexed

  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstStr = toDateStr(firstDay);
  const lastStr = toDateStr(lastDay);

  // Fetch all deliverables for active deals that have any event in this month
  const { data: deliverables } = await admin
    .from("deliverables")
    .select(`
      id, deliverable_type, sequence, status,
      due_date, admin_review_due_date, live_date, brief_doc_url, brief_sent_at,
      updated_at,
      deal:deal_id(id, influencer_name, platform_primary, status)
    `)
    .or(
      [
        `due_date.gte.${firstStr}`,
        `admin_review_due_date.gte.${firstStr}`,
        `live_date.gte.${firstStr}`,
        `and(status.in.(submitted,approved),updated_at.gte.${firstDay.toISOString()})`,
      ].join(",")
    )
    .or(
      [
        `due_date.lte.${lastStr}`,
        `admin_review_due_date.lte.${lastStr}`,
        `live_date.lte.${lastStr}`,
        `and(status.in.(submitted,approved),updated_at.lte.${lastDay.toISOString()})`,
      ].join(",")
    )
    .order("due_date", { ascending: true });

  // Filter to active deals only (done in JS to avoid complex nested filter)
  const ACTIVE_DEAL_STATUSES = new Set(["approved", "contracted", "live"]);
  const filtered = (deliverables ?? []).filter(d => {
    const deal = d.deal as unknown as { status: string } | null;
    return deal && ACTIVE_DEAL_STATUSES.has(deal.status);
  });

  // "BRIEFS STILL NEEDED" sidebar — driven by deals.deliverables JSON so it
  // works even before tracker rows exist in the deliverables table.
  // Source of truth for "sent" = brief_sent_at on the tracker row.
  const SKIP_BRIEF_CODES = new Set(["WHITELIST", "PAID_AD", "RAW_FOOTAGE", "LINK_BIO", "IGS"]);

  // 1. Fetch active deals with their deliverables JSON
  const { data: activeDeals } = await admin
    .from("deals")
    .select("id, influencer_name, status, deliverables")
    .in("status", [...ACTIVE_DEAL_STATUSES]);

  // 2. Fetch tracker rows that have already had a brief sent, keyed by deal
  const activeDealIds = (activeDeals ?? []).map(d => d.id as string);
  const { data: sentRows } = activeDealIds.length > 0
    ? await admin
        .from("deliverables")
        .select("deal_id, deliverable_type, sequence, brief_sent_at")
        .in("deal_id", activeDealIds)
        .not("brief_sent_at", "is", null)
    : { data: [] };

  // Build set: dealId → Set of "TYPE_seq" that already have a brief sent
  const sentByDeal = new Map<string, Set<string>>();
  for (const row of sentRows ?? []) {
    const key = `${row.deliverable_type}_${row.sequence ?? 1}`;
    if (!sentByDeal.has(row.deal_id)) sentByDeal.set(row.deal_id, new Set());
    sentByDeal.get(row.deal_id)!.add(key);
  }

  // 3. For each active deal, enumerate deliverable slots not yet briefed
  const pendingFiltered: PendingBriefItem[] = [];
  for (const deal of activeDeals ?? []) {
    const dealId = deal.id as string;
    const sent = sentByDeal.get(dealId) ?? new Set<string>();
    const slots = ((deal.deliverables as Array<{ code: string; count: number }> | null) ?? [])
      .filter(d => d?.code && d.count > 0 && !SKIP_BRIEF_CODES.has(d.code));

    for (const slot of slots) {
      for (let seq = 1; seq <= slot.count; seq++) {
        if (!sent.has(`${slot.code}_${seq}`)) {
          pendingFiltered.push({
            id: `${dealId}_${slot.code}_${seq}`,
            deliverable_type: slot.code,
            sequence: seq,
            brief_doc_url: null,
            brief_sent_at: null,
            deal: {
              id: dealId,
              influencer_name: deal.influencer_name as string,
              status: deal.status as string,
            },
          });
        }
      }
    }
  }

  const currentMonthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">Content Calendar</h1>
        <p className="text-im8-burgundy/60 mt-1 text-sm">
          Deliverable deadlines, submissions, and live dates across all active partnerships.
        </p>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        currentMonth={currentMonthStr}
        deliverables={filtered as unknown as CalendarDeliverable[]}
        pendingBriefs={pendingFiltered as unknown as PendingBriefItem[]}
      />
    </div>
  );
}

// Types re-exported for the client component to use
export type CalendarDeliverable = {
  id: string;
  deliverable_type: string;
  sequence: number | null;
  status: string;
  due_date: string | null;
  admin_review_due_date: string | null;
  live_date: string | null;
  brief_doc_url: string | null;
  brief_sent_at: string | null;
  updated_at: string;
  deal: { id: string; influencer_name: string; platform_primary: string; status: string };
};

export type PendingBriefItem = {
  id: string;
  deliverable_type: string;
  sequence: number | null;
  brief_doc_url: string | null;
  brief_sent_at: string | null;
  deal: { id: string; influencer_name: string; status: string };
};
