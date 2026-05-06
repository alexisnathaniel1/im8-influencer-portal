import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getBriefsPendingToSend,
  getSubmissionsAwaitingReview,
  getReviewsDueThisWeek,
  getContractsExpiringSoon,
  getRecentInboxEmails,
  getWeeklyOutlook,
  getFinancialSummary,
  type FinancialSummary,
} from "@/lib/dashboard/queries";
import { summarizeEmail } from "@/lib/email/summary";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function daysBetween(iso: string): number {
  const target = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatMoney(cents: number | null, months: number | null): string {
  if (cents == null) return "—";
  const monthly = (cents / 100).toLocaleString("en-AU", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  if (months) return `${monthly}/mo · ${months}mo`;
  return monthly;
}

export default async function WorkflowDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const canSeeFinancials = ["admin", "management"].includes(
    (currentProfile as { role?: string } | null)?.role ?? "",
  );

  const admin = createAdminClient();

  const [
    briefsToSend,
    submissionsAwaitingReview,
    reviewsDueThisWeek,
    contractsExpiring,
    recentEmails,
    outlook,
    financials,
  ] = await Promise.all([
    getBriefsPendingToSend(admin),
    getSubmissionsAwaitingReview(admin),
    getReviewsDueThisWeek(admin),
    getContractsExpiringSoon(admin, 14),
    getRecentInboxEmails(admin, 5),
    getWeeklyOutlook(admin),
    canSeeFinancials ? getFinancialSummary(admin) : Promise.resolve(null as FinancialSummary | null),
  ]);

  const kpiCards = [
    {
      label: "Briefs to send",
      value: briefsToSend.count,
      sub: "active contracts",
      href: "/admin/calendar",
      tone: "orange",
    },
    {
      label: "Awaiting review",
      value: submissionsAwaitingReview.count,
      sub: "submissions queued",
      href: "/admin/review",
      tone: "amber",
    },
    {
      label: "Reviews due this week",
      value: reviewsDueThisWeek.count,
      sub: "deadline within 7 days",
      href: "/admin/review",
      tone: "indigo",
    },
    {
      label: "Contracts expiring",
      value: contractsExpiring.count,
      sub: "in next 14 days",
      href: "/admin/roster?expiring=1",
      tone: "fuchsia",
    },
  ];

  const toneClasses: Record<string, string> = {
    orange: "text-orange-600",
    amber: "text-amber-600",
    indigo: "text-indigo-600",
    fuchsia: "text-fuchsia-600",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-[40px] leading-tight font-bold text-im8-maroon">Workflow</h1>
        <p className="text-im8-muted mt-1 text-[14px]">
          Today&apos;s briefs to send, content in review, contract renewals, and recent partner emails.
        </p>
      </div>

      {/* Band 1 — KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="group bg-white rounded-xl border border-im8-stone/30 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-im8-stone/50"
          >
            <div className={`text-[32px] font-bold leading-none ${toneClasses[c.tone]}`}>{c.value}</div>
            <div className="text-[13px] font-semibold text-im8-maroon mt-2.5">{c.label}</div>
            <div className="text-[11px] text-im8-muted mt-0.5">{c.sub}</div>
          </Link>
        ))}
      </div>

      {/* Band 1b — Financial summary (admin + management only) */}
      {canSeeFinancials && financials && (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-5">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-1">
                💰 Active Monthly Spend
              </div>
              <div className="text-[28px] font-bold text-im8-gold leading-none">
                {financials.totalMonthlyUsd.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
                <span className="text-[14px] font-normal text-im8-muted ml-1">/month</span>
              </div>
              <div className="text-[12px] text-im8-muted mt-1">
                {financials.activePartners} active partner{financials.activePartners !== 1 ? "s" : ""}
              </div>
            </div>

            {Object.keys(financials.byPlatform).length > 0 && (
              <div className="flex flex-wrap gap-4 ml-auto">
                {Object.entries(financials.byPlatform)
                  .sort(([, a], [, b]) => b - a)
                  .map(([platform, amount]) => (
                    <div key={platform} className="text-center">
                      <div className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.08em]">
                        {platform}
                      </div>
                      <div className="text-[15px] font-semibold text-im8-maroon mt-0.5">
                        {amount.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Band 2 — Action lists + Recent emails */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: 3-section action list (60%) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Briefs to send */}
          <section className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
            <header className="px-5 py-3 border-b border-im8-stone/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <h2 className="text-[13px] font-bold text-im8-maroon uppercase tracking-[0.08em]">Briefs to send</h2>
              </div>
              <span className="text-[11px] text-im8-muted">{briefsToSend.count}</span>
            </header>
            <div className="divide-y divide-im8-stone/15">
              {briefsToSend.items.length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-im8-muted text-center">All caught up — every active contract has a brief sent.</p>
              ) : (
                briefsToSend.items.slice(0, 8).map((d) => {
                  const deal = d.deal as unknown as { id: string; influencer_name: string };
                  const seq = d.sequence as number | null;
                  const label = seq ? `${d.deliverable_type} #${seq}` : (d.deliverable_type as string);
                  return (
                    <Link
                      key={d.id as string}
                      href={`/admin/deals/${deal.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-im8-offwhite transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-im8-maroon truncate">{deal.influencer_name}</p>
                        <p className="text-[11px] text-im8-muted">{label}</p>
                      </div>
                      <span className="text-[11px] text-im8-red shrink-0 ml-3">Open deal →</span>
                    </Link>
                  );
                })
              )}
              {briefsToSend.items.length > 8 && (
                <Link href="/admin/calendar" className="block px-5 py-2.5 text-[11px] text-im8-muted hover:text-im8-red text-center">
                  View all {briefsToSend.count} →
                </Link>
              )}
            </div>
          </section>

          {/* In review queue */}
          <section className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
            <header className="px-5 py-3 border-b border-im8-stone/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <h2 className="text-[13px] font-bold text-im8-maroon uppercase tracking-[0.08em]">In review queue</h2>
              </div>
              <span className="text-[11px] text-im8-muted">{submissionsAwaitingReview.count}</span>
            </header>
            <div className="divide-y divide-im8-stone/15">
              {submissionsAwaitingReview.items.length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-im8-muted text-center">Nothing waiting.</p>
              ) : (
                submissionsAwaitingReview.items.slice(0, 8).map((s) => {
                  const deal = s.deal as unknown as { id: string; influencer_name: string };
                  return (
                    <Link
                      key={s.id as string}
                      href="/admin/review"
                      className="flex items-center justify-between px-5 py-3 hover:bg-im8-offwhite transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-im8-maroon truncate">{deal.influencer_name}</p>
                        <p className="text-[11px] text-im8-muted capitalize">
                          {(s.content_type as string).replace(/_/g, " ")} · Submitted {timeAgo(s.submitted_at as string)}
                        </p>
                      </div>
                      <span className="text-[11px] text-im8-red shrink-0 ml-3">Review →</span>
                    </Link>
                  );
                })
              )}
              {submissionsAwaitingReview.items.length > 8 && (
                <Link href="/admin/review" className="block px-5 py-2.5 text-[11px] text-im8-muted hover:text-im8-red text-center">
                  View all {submissionsAwaitingReview.count} →
                </Link>
              )}
            </div>
          </section>

          {/* Contracts expiring */}
          <section className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
            <header className="px-5 py-3 border-b border-im8-stone/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-fuchsia-500" />
                <h2 className="text-[13px] font-bold text-im8-maroon uppercase tracking-[0.08em]">Contracts expiring soon</h2>
              </div>
              <span className="text-[11px] text-im8-muted">{contractsExpiring.count}</span>
            </header>
            <div className="divide-y divide-im8-stone/15">
              {contractsExpiring.items.length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-im8-muted text-center">No contracts expiring in the next 14 days.</p>
              ) : (
                contractsExpiring.items.map((d) => {
                  const days = d.campaign_end ? daysBetween(d.campaign_end as string) : null;
                  return (
                    <div
                      key={d.id as string}
                      className="flex items-center justify-between px-5 py-3 hover:bg-im8-offwhite transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-im8-maroon truncate">
                          {d.influencer_name}{" "}
                          <span className="text-[11px] font-normal text-im8-muted">
                            · Contract {d.contract_sequence ?? 1}
                          </span>
                        </p>
                        <p className="text-[11px] text-im8-muted">
                          {formatMoney(d.monthly_rate_cents as number | null, d.total_months as number | null)}
                          {days !== null && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              days <= 7 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                            }`}>
                              {days <= 0 ? "Expires today" : `${days}d left`}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <Link href={`/admin/deals/${d.id}`} className="text-[11px] text-im8-muted hover:text-im8-red">
                          View
                        </Link>
                        <Link
                          href={`/admin/deals/new-contract?from=${d.id}`}
                          className="text-[11px] font-semibold text-im8-red hover:underline"
                        >
                          Renew →
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Right: Recent emails (40%) */}
        <div className="lg:col-span-2">
          <section className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden sticky top-6">
            <header className="px-5 py-3 border-b border-im8-stone/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-im8-maroon"/>
                  <path d="M2 4l6 4 6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-im8-maroon"/>
                </svg>
                <h2 className="text-[13px] font-bold text-im8-maroon uppercase tracking-[0.08em]">Recent emails</h2>
              </div>
              <Link href="/admin/inbox" className="text-[11px] text-im8-muted hover:text-im8-red">View all →</Link>
            </header>
            <div className="divide-y divide-im8-stone/15">
              {recentEmails.items.length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-im8-muted text-center">No emails yet.</p>
              ) : (
                recentEmails.items.map((e) => {
                  const summary = summarizeEmail(e.body_text as string | null, 90);
                  const fromDisplay = (e.from_name as string | null) || (e.from_email as string);
                  const isUnread = !(e.is_read as boolean);
                  return (
                    <Link
                      key={e.id as string}
                      href="/admin/inbox"
                      className={`block px-5 py-3 hover:bg-im8-offwhite transition-colors ${isUnread ? "bg-blue-50/40" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${isUnread ? "bg-im8-red" : "bg-transparent"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-[12px] truncate ${isUnread ? "font-semibold text-im8-maroon" : "text-im8-maroon/70"}`}>
                              {fromDisplay}
                            </p>
                            <span className="text-[10px] text-im8-muted shrink-0">{timeAgo(e.received_at as string)}</span>
                          </div>
                          <p className={`text-[12px] mt-0.5 truncate ${isUnread ? "font-medium text-im8-maroon" : "text-im8-maroon/60"}`}>
                            {e.subject as string}
                          </p>
                          {summary && (
                            <p className="text-[11px] text-im8-muted truncate mt-0.5">{summary}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Band 3 — Weekly outlook */}
      <section className="bg-white rounded-xl border border-im8-stone/30 p-5">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-bold text-im8-maroon uppercase tracking-[0.08em]">7-day outlook</h2>
          <Link href="/admin/calendar" className="text-[11px] text-im8-muted hover:text-im8-red">Open full calendar →</Link>
        </header>
        <div className="grid grid-cols-7 gap-2">
          {outlook.map((day, idx) => (
            <div
              key={day.date}
              className={`rounded-lg border p-3 ${idx === 0 ? "border-im8-red/30 bg-im8-red/5" : "border-im8-stone/30 bg-im8-offwhite"}`}
            >
              <div className="text-[10px] font-semibold text-im8-muted uppercase tracking-[0.05em]">{day.weekday}</div>
              <div className="text-[18px] font-bold text-im8-maroon leading-none mt-0.5">{day.dayNum}</div>
              <div className="space-y-0.5 mt-2">
                {day.briefsDue > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-orange-700">
                    <span className="w-1 h-1 rounded-full bg-orange-500" />
                    {day.briefsDue} brief{day.briefsDue === 1 ? "" : "s"}
                  </div>
                )}
                {day.reviewsDue > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-indigo-700">
                    <span className="w-1 h-1 rounded-full bg-indigo-500" />
                    {day.reviewsDue} review{day.reviewsDue === 1 ? "" : "s"}
                  </div>
                )}
                {day.posting > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-fuchsia-700">
                    <span className="w-1 h-1 rounded-full bg-fuchsia-500" />
                    {day.posting} live
                  </div>
                )}
                {day.briefsDue + day.reviewsDue + day.posting === 0 && (
                  <div className="text-[10px] text-im8-muted/60">—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
