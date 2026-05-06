"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarDeliverable, PendingBriefItem } from "./page";

// ── Colour + label config ────────────────────────────────────────────────────
type EventKind = "submit_due" | "review_due" | "submitted" | "approved" | "live";

// Colour palette tuned for visual distinction at a glance — all 5 states sit
// in different hue families so Approved/Live and Creator-deadline/Submitted
// don't blur together.
const KIND_CONFIG: Record<EventKind, { label: string; bg: string; text: string; dot: string }> = {
  submit_due: { label: "Creator deadline", bg: "bg-orange-50",  text: "text-orange-800",  dot: "bg-orange-500"  },
  review_due: { label: "Review deadline",  bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-500"  },
  submitted:  { label: "Submitted",        bg: "bg-teal-50",    text: "text-teal-700",    dot: "bg-teal-500"    },
  approved:   { label: "Approved",         bg: "bg-lime-50",    text: "text-lime-800",    dot: "bg-lime-600"    },
  live:       { label: "Live",             bg: "bg-fuchsia-50", text: "text-fuchsia-700", dot: "bg-fuchsia-500" },
};

type CalEvent = {
  kind: EventKind;
  deliverableId: string;
  dealId: string;
  influencerName: string;
  deliverableLabel: string;
};

function deliverableLabel(type: string, seq: number | null) {
  return seq ? `${type} #${seq}` : type;
}

// Build a map of YYYY-MM-DD → CalEvent[]
function buildEventMap(deliverables: CalendarDeliverable[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>();

  function addEvent(dateStr: string | null, event: CalEvent) {
    if (!dateStr) return;
    const day = dateStr.split("T")[0]; // normalise timestamp to date
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(event);
  }

  for (const d of deliverables) {
    const label = deliverableLabel(d.deliverable_type, d.sequence);
    const base = {
      deliverableId: d.id,
      dealId: d.deal.id,
      influencerName: d.deal.influencer_name,
      deliverableLabel: label,
    };

    addEvent(d.due_date,              { ...base, kind: "submit_due" });
    addEvent(d.admin_review_due_date, { ...base, kind: "review_due" });
    addEvent(d.live_date,             { ...base, kind: "live"       });

    // submitted / approved — place on the date the status was last updated
    if (d.status === "submitted") addEvent(d.updated_at, { ...base, kind: "submitted" });
    if (d.status === "approved")  addEvent(d.updated_at, { ...base, kind: "approved"  });
  }

  return map;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CalendarGrid({
  year,
  month,
  currentMonth,
  deliverables,
  pendingBriefs,
}: {
  year: number;
  month: number;
  currentMonth: string;
  deliverables: CalendarDeliverable[];
  pendingBriefs: PendingBriefItem[];
}) {
  const router = useRouter();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const eventMap = buildEventMap(deliverables);

  // Build calendar grid: days in month + leading/trailing blanks
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  const todayStr = new Date().toISOString().split("T")[0];

  const cells: Array<{ dateStr: string; day: number } | null> = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return { dateStr: d.toISOString().split("T")[0], day: i + 1 };
    }),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  // Month navigation
  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  function toMonthStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const monthLabel = firstDay.toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  return (
    <div className="flex gap-5">
      {/* ── Calendar grid ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push(`/admin/calendar?month=${toMonthStr(prevMonth)}`)}
            className="px-3 py-1.5 text-sm text-im8-burgundy/60 hover:text-im8-burgundy border border-im8-stone/30 rounded-lg transition-colors"
          >
            ← Prev
          </button>
          <h2 className="text-lg font-bold text-im8-burgundy">{monthLabel}</h2>
          <button
            onClick={() => router.push(`/admin/calendar?month=${toMonthStr(nextMonth)}`)}
            className="px-3 py-1.5 text-sm text-im8-burgundy/60 hover:text-im8-burgundy border border-im8-stone/30 rounded-lg transition-colors"
          >
            Next →
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {(Object.entries(KIND_CONFIG) as [EventKind, typeof KIND_CONFIG[EventKind]][]).map(([kind, cfg]) => (
            <span key={kind} className="flex items-center gap-1.5 text-[11px] text-im8-burgundy/60">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          ))}
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-im8-muted uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 border-l border-t border-im8-stone/20">
          {cells.map((cell, i) => {
            if (!cell) {
              return <div key={`blank-${i}`} className="border-r border-b border-im8-stone/20 min-h-[90px] bg-im8-offwhite/40" />;
            }

            const { dateStr, day } = cell;
            const events = eventMap.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            const isExpanded = expandedDay === dateStr;

            return (
              <div
                key={dateStr}
                className={`border-r border-b border-im8-stone/20 min-h-[90px] p-1.5 cursor-pointer transition-colors ${
                  isToday ? "bg-im8-burgundy/5" : "bg-white hover:bg-im8-offwhite"
                }`}
                onClick={() => setExpandedDay(isExpanded ? null : dateStr)}
              >
                <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? "bg-im8-burgundy text-white" : "text-im8-burgundy/60"
                }`}>
                  {day}
                </div>

                <div className="space-y-0.5">
                  {events.slice(0, 3).map((ev, j) => {
                    const cfg = KIND_CONFIG[ev.kind];
                    return (
                      <div
                        key={j}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate ${cfg.bg} ${cfg.text} leading-tight`}
                        title={`${ev.influencerName} — ${ev.deliverableLabel}`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1 align-middle`} />
                        {ev.influencerName}
                      </div>
                    );
                  })}
                  {events.length > 3 && (
                    <div className="text-[10px] text-im8-burgundy/40 px-1">+{events.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded day panel */}
        {expandedDay && (() => {
          const events = eventMap.get(expandedDay) ?? [];
          const d = new Date(expandedDay + "T00:00:00");
          const label = d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
          return (
            <div className="mt-4 bg-white rounded-xl border border-im8-stone/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-im8-burgundy">{label}</h3>
                <button
                  onClick={() => setExpandedDay(null)}
                  className="text-im8-burgundy/40 hover:text-im8-burgundy text-sm"
                >
                  ✕ Close
                </button>
              </div>

              {events.length === 0 ? (
                <p className="text-sm text-im8-burgundy/40">No events on this day.</p>
              ) : (
                <div className="space-y-2">
                  {/* Group by kind */}
                  {(Object.keys(KIND_CONFIG) as EventKind[]).map(kind => {
                    const kindEvents = events.filter(e => e.kind === kind);
                    if (kindEvents.length === 0) return null;
                    const cfg = KIND_CONFIG[kind];
                    return (
                      <div key={kind}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-im8-muted mb-1.5">{cfg.label}</p>
                        <div className="space-y-1">
                          {kindEvents.map((ev, j) => (
                            <a
                              key={j}
                              href={`/admin/deals/${ev.dealId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg} ${cfg.text} text-sm hover:opacity-80 transition-opacity`}
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                              <span className="font-medium">{ev.influencerName}</span>
                              <span className="text-xs opacity-70">— {ev.deliverableLabel}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Pending briefs sidebar ──────────────────────────────────────── */}
      <div className="w-72 shrink-0">
        <div className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden sticky top-6">
          <div className="px-4 py-3 border-b border-im8-stone/20 bg-im8-offwhite">
            <p className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.12em]">
              Briefs still needed
            </p>
            <p className="text-xs text-im8-burgundy/50 mt-0.5">Active contracts with no brief sent</p>
          </div>

          {pendingBriefs.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-im8-burgundy/40">
              ✓ All briefs sent
            </div>
          ) : (
            <div className="divide-y divide-im8-stone/20 max-h-[600px] overflow-y-auto">
              {pendingBriefs.map(pb => {
                const deal = pb.deal as { id: string; influencer_name: string };
                const label = deliverableLabel(pb.deliverable_type, pb.sequence);
                return (
                  <a
                    key={pb.id}
                    href={`/admin/deals/${deal.id}?tab=briefs`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-im8-offwhite transition-colors"
                  >
                    <span className="mt-0.5 w-2 h-2 rounded-full bg-red-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-im8-burgundy truncate">{deal.influencer_name}</p>
                      <p className="text-xs text-im8-burgundy/50">{label}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
