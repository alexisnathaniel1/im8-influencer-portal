// Shared data helpers for the Workflow Dashboard at /admin/workflow.
// Each function returns a small, serialisable shape so the page can render
// both KPI counts and detail lists from the same fetch.

import type { SupabaseClient } from "@supabase/supabase-js";

const ACTIVE_DEAL_STATUSES = ["pending_approval", "approved", "contracted", "live"] as const;

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Briefs that haven't been sent yet on active contracts.
// Source of truth: brief_sent_at IS NULL (don't check brief_doc_url so a
// previously-sent brief whose URL was cleared doesn't reappear).
export async function getBriefsPendingToSend(admin: SupabaseClient) {
  const { data } = await admin
    .from("deliverables")
    .select(`
      id, deliverable_type, sequence, due_date, created_at,
      deal:deal_id(id, influencer_name, status)
    `)
    .is("brief_sent_at", null)
    .not("status", "in", '("live","completed","approved")')
    .order("created_at", { ascending: true });

  const items = (data ?? []).filter((d) => {
    const deal = d.deal as unknown as { id: string; influencer_name: string; status: string } | null;
    return deal && (ACTIVE_DEAL_STATUSES as readonly string[]).includes(deal.status);
  });

  return { count: items.length, items };
}

// Submissions waiting for an admin to review them. Matches the filter used
// on /admin/review (status = 'pending'). Scripts are filtered out — they auto-
// approve on insert and never enter the review queue.
export async function getSubmissionsAwaitingReview(admin: SupabaseClient) {
  const { data } = await admin
    .from("submissions")
    .select(`
      id, submitted_at, content_type, deliverable_id,
      deal:deal_id(id, influencer_name)
    `)
    .eq("status", "pending")
    .eq("is_script", false)
    .order("submitted_at", { ascending: true });

  return { count: (data ?? []).length, items: data ?? [] };
}

// Reviews due this week — deliverables whose admin_review_due_date falls in
// the next 7 days and which still have an outstanding submission.
export async function getReviewsDueThisWeek(admin: SupabaseClient) {
  const today = startOfDay();
  const weekOut = addDays(today, 7);

  const { data } = await admin
    .from("deliverables")
    .select(`
      id, deliverable_type, sequence, admin_review_due_date, status,
      deal:deal_id(id, influencer_name, status)
    `)
    .gte("admin_review_due_date", isoDate(today))
    .lte("admin_review_due_date", isoDate(weekOut))
    .in("status", ["submitted", "in_progress"])
    .order("admin_review_due_date", { ascending: true });

  const items = (data ?? []).filter((d) => {
    const deal = d.deal as unknown as { id: string; influencer_name: string; status: string } | null;
    return deal && (ACTIVE_DEAL_STATUSES as readonly string[]).includes(deal.status);
  });

  return { count: items.length, items };
}

// Contracts ending within `days` (default 14).
export async function getContractsExpiringSoon(admin: SupabaseClient, days = 14) {
  const today = startOfDay();
  const cutoff = addDays(today, days);

  const { data } = await admin
    .from("deals")
    .select("id, influencer_name, campaign_end, contract_sequence, status, monthly_rate_cents, total_months")
    .gte("campaign_end", isoDate(today))
    .lte("campaign_end", isoDate(cutoff))
    .in("status", ["contracted", "live", "approved"])
    .order("campaign_end", { ascending: true });

  return { count: (data ?? []).length, items: data ?? [] };
}

// Latest N inbox emails for the right-column widget.
export async function getRecentInboxEmails(admin: SupabaseClient, limit = 5) {
  const { data } = await admin
    .from("inbox_emails")
    .select("id, from_email, from_name, subject, body_text, received_at, is_read, linked_deal_id")
    .order("received_at", { ascending: false })
    .limit(limit);

  return { count: (data ?? []).length, items: data ?? [] };
}

// Financial summary — total active monthly retainer spend across all active deals.
// Only shown to admin + management roles (gated in the page component).
export type FinancialSummary = {
  totalMonthlyUsd: number;            // sum of monthly_rate_cents / 100
  totalContractUsd: number;           // sum of monthly_rate_cents * total_months / 100
  activePartners: number;             // number of deals included
  byPlatform: Record<string, number>; // platform → monthly USD
};

export async function getFinancialSummary(admin: SupabaseClient): Promise<FinancialSummary> {
  const { data } = await admin
    .from("deals")
    .select("monthly_rate_cents, total_months, platform_primary")
    .in("status", ["approved", "contracted", "live"]);

  const rows = data ?? [];
  const totalMonthlyUsd = rows.reduce(
    (sum, d) => sum + ((d.monthly_rate_cents as number | null) ?? 0),
    0,
  ) / 100;

  const totalContractUsd = rows.reduce(
    (sum, d) => {
      const monthly = (d.monthly_rate_cents as number | null) ?? 0;
      const months = (d.total_months as number | null) ?? 1;
      return sum + monthly * months;
    },
    0,
  ) / 100;

  const byPlatform: Record<string, number> = {};
  for (const d of rows) {
    const platform = (d.platform_primary as string | null) ?? "Other";
    const monthly = ((d.monthly_rate_cents as number | null) ?? 0) / 100;
    byPlatform[platform] = (byPlatform[platform] ?? 0) + monthly;
  }

  return { totalMonthlyUsd, totalContractUsd, activePartners: rows.length, byPlatform };
}

// 7-day outlook: per day, how many briefs are due, how many reviews are due,
// and how many posts are scheduled to go live.
export type OutlookDay = {
  date: string;            // YYYY-MM-DD
  weekday: string;         // "Mon", "Tue", ...
  dayNum: number;          // 1–31
  briefsDue: number;
  reviewsDue: number;
  posting: number;
};

export async function getWeeklyOutlook(admin: SupabaseClient): Promise<OutlookDay[]> {
  const today = startOfDay();
  const start = isoDate(today);
  const end = isoDate(addDays(today, 6));

  const { data: deliverables } = await admin
    .from("deliverables")
    .select("due_date, admin_review_due_date, live_date, status, deal:deal_id(status)")
    .or(
      [
        `due_date.gte.${start}`,
        `admin_review_due_date.gte.${start}`,
        `live_date.gte.${start}`,
      ].join(",")
    )
    .or(
      [
        `due_date.lte.${end}`,
        `admin_review_due_date.lte.${end}`,
        `live_date.lte.${end}`,
      ].join(",")
    );

  const filtered = (deliverables ?? []).filter((d) => {
    const deal = d.deal as unknown as { status: string } | null;
    return deal && (ACTIVE_DEAL_STATUSES as readonly string[]).includes(deal.status);
  });

  const days: OutlookDay[] = [];
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const dateStr = isoDate(d);
    const briefsDue = filtered.filter(
      (x) => (x.due_date as string | null)?.startsWith(dateStr),
    ).length;
    const reviewsDue = filtered.filter(
      (x) => (x.admin_review_due_date as string | null)?.startsWith(dateStr),
    ).length;
    const posting = filtered.filter(
      (x) => (x.live_date as string | null)?.startsWith(dateStr),
    ).length;

    days.push({
      date: dateStr,
      weekday: weekdayLabels[d.getDay()],
      dayNum: d.getDate(),
      briefsDue,
      reviewsDue,
      posting,
    });
  }

  return days;
}
