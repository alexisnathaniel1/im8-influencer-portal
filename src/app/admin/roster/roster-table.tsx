"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type RosterRow = {
  id: string;
  influencerName: string;
  influencerEmail: string | null;
  agencyName: string | null;
  platform: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  youtubeHandle: string | null;
  followerCount: number | null;
  nicheTags: string[];
  monthlyRateCents: number | null;
  totalMonths: number | null;
  totalRateCents: number | null;
  campaignStart: string | null;
  campaignEnd: string | null;
  status: string;
  contractSequence: number;
  driveFolderId: string | null;
  pic: string | null;
  // Progress on the contract — surfaced in the new "Progress" column.
  // Total = all tracker rows for this deal (rights/extras already excluded).
  // Done = rows with status 'live' or 'completed'.
  deliverablesTotal: number;
  deliverablesDone: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "In Approval",
  approved: "Approved",
  contracted: "Contracted",
  live: "Live",
};

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-blue-50 text-blue-700",
  approved: "bg-lime-50 text-lime-800",
  contracted: "bg-amber-50 text-amber-800",
  live: "bg-fuchsia-50 text-fuchsia-700",
};

const PLATFORM_OPTIONS = ["instagram", "tiktok", "youtube"] as const;

function formatCount(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return dollars.toLocaleString("en-AU", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// "Month 2 of 3" — current contract month based on today vs campaign_start.
// Returns null if no start date or contract hasn't started yet.
// Caps at total_months even if the contract has run over.
function contractMonth(start: string | null, totalMonths: number | null): { current: number; total: number } | null {
  if (!start || !totalMonths) return null;
  const startDate = new Date(start);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < startDate) return null;
  const monthsElapsed = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
  );
  const current = Math.min(monthsElapsed + 1, totalMonths);
  return { current, total: totalMonths };
}

function handleFor(row: RosterRow): string | null {
  const platform = row.platform?.toLowerCase();
  if (platform === "instagram") return row.instagramHandle;
  if (platform === "tiktok") return row.tiktokHandle;
  if (platform === "youtube") return row.youtubeHandle;
  return row.instagramHandle ?? row.tiktokHandle ?? row.youtubeHandle;
}

type SortKey =
  | "influencerName" | "platform" | "followerCount" | "monthlyRateCents"
  | "totalRateCents" | "campaignStart" | "campaignEnd" | "contractSequence" | "status";

export default function RosterTable({
  rows,
  initialExpiringOnly = false,
}: {
  rows: RosterRow[];
  initialExpiringOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [niches, setNiches] = useState<string[]>([]);
  const [agency, setAgency] = useState<string>("");
  const [minRate, setMinRate] = useState<string>("");
  const [maxRate, setMaxRate] = useState<string>("");
  const [expiringOnly, setExpiringOnly] = useState(initialExpiringOnly);

  const [sortKey, setSortKey] = useState<SortKey>("influencerName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Optimistic local override of dates so saved edits show immediately
  const [dateOverrides, setDateOverrides] = useState<Record<string, { start?: string; end?: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const router = useRouter();

  function getStart(r: RosterRow): string | null {
    return dateOverrides[r.id]?.start ?? r.campaignStart;
  }
  function getEnd(r: RosterRow): string | null {
    return dateOverrides[r.id]?.end ?? r.campaignEnd;
  }

  async function saveDates(rowId: string, payload: { campaign_start?: string | null; campaign_end?: string | null }) {
    setSavingId(rowId);
    try {
      const res = await fetch(`/api/deals/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error("Failed to save campaign date");
        return;
      }
      // Refresh server data so any auto-calc (end from start + months) flows back in
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  function onChangeStart(row: RosterRow, value: string) {
    const start = value || null;
    let end: string | null = null;
    // Auto-calc end if total_months is known and either no end, or end before new start
    if (start && row.totalMonths) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + row.totalMonths);
      end = d.toISOString().split("T")[0];
    }
    setDateOverrides(prev => ({
      ...prev,
      [row.id]: { start: start ?? undefined, end: end ?? prev[row.id]?.end ?? row.campaignEnd ?? undefined },
    }));
    void saveDates(row.id, { campaign_start: start, ...(end ? { campaign_end: end } : {}) });
  }

  function onChangeEnd(row: RosterRow, value: string) {
    const end = value || null;
    setDateOverrides(prev => ({
      ...prev,
      [row.id]: { start: prev[row.id]?.start ?? row.campaignStart ?? undefined, end: end ?? undefined },
    }));
    void saveDates(row.id, { campaign_end: end });
  }

  const allNiches = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.nicheTags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [rows]);

  const allAgencies = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.agencyName) s.add(r.agencyName); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minDollars = minRate ? Number(minRate) : null;
    const maxDollars = maxRate ? Number(maxRate) : null;

    let out = rows.filter((r) => {
      if (q) {
        const hay = [r.influencerName, r.agencyName, r.instagramHandle, r.tiktokHandle, r.youtubeHandle, r.influencerEmail]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statuses.length && !statuses.includes(r.status)) return false;
      if (platforms.length && !(r.platform && platforms.includes(r.platform))) return false;
      if (niches.length && !r.nicheTags.some((t) => niches.includes(t))) return false;
      if (agency && r.agencyName !== agency) return false;
      if (minDollars != null && (r.monthlyRateCents == null || r.monthlyRateCents / 100 < minDollars)) return false;
      if (maxDollars != null && (r.monthlyRateCents == null || r.monthlyRateCents / 100 > maxDollars)) return false;
      if (expiringOnly) {
        const d = daysUntil(r.campaignEnd);
        if (d == null || d > 30) return false;
      }
      return true;
    });

    out = out.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

    return out;
  }, [rows, search, statuses, platforms, niches, agency, minRate, maxRate, expiringOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function toggleIn<T>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
  }

  function downloadCsv() {
    const headers = [
      "Influencer", "Email", "Agency", "Platform", "Handle", "Followers",
      "Niche", "Monthly Rate ($)", "Total ($)", "Months",
      "Start", "End", "Days Until Expiry", "Contract", "Status", "PIC", "Drive Folder URL",
    ];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const days = daysUntil(r.campaignEnd);
      const cells = [
        r.influencerName,
        r.influencerEmail ?? "",
        r.agencyName ?? "",
        r.platform ?? "",
        handleFor(r) ?? "",
        r.followerCount?.toString() ?? "",
        r.nicheTags.join("; "),
        r.monthlyRateCents != null ? (r.monthlyRateCents / 100).toString() : "",
        r.totalRateCents != null ? (r.totalRateCents / 100).toString() : "",
        r.totalMonths?.toString() ?? "",
        r.campaignStart ?? "",
        r.campaignEnd ?? "",
        days != null ? days.toString() : "",
        r.contractSequence.toString(),
        STATUS_LABELS[r.status] ?? r.status,
        r.pic ?? "",
        r.driveFolderId ? `https://drive.google.com/drive/folders/${r.driveFolderId}` : "",
      ].map((c) => {
        const v = String(c);
        return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      });
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    setSearch("");
    setStatuses([]);
    setPlatforms([]);
    setNiches([]);
    setAgency("");
    setMinRate("");
    setMaxRate("");
    setExpiringOnly(false);
  }

  const hasFilters = search || statuses.length || platforms.length || niches.length || agency || minRate || maxRate || expiringOnly;

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <div className="bg-white rounded-xl border border-im8-stone/30 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search by name, agency, handle, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30"
          />
          <select
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            className="px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30"
          >
            <option value="">All agencies</option>
            {allAgencies.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-im8-muted whitespace-nowrap">Rate $</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="min"
              value={minRate}
              onChange={(e) => setMinRate(e.target.value)}
              className="w-24 px-2 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30"
            />
            <span className="text-[12px] text-im8-muted">to</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="max"
              value={maxRate}
              onChange={(e) => setMaxRate(e.target.value)}
              className="w-24 px-2 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-im8-muted uppercase tracking-[0.05em] font-semibold">Status</span>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatuses(toggleIn(statuses, key))}
                className={`text-[11px] px-2 py-1 rounded-full font-medium transition-colors ${
                  statuses.includes(key)
                    ? "bg-im8-burgundy text-white"
                    : "bg-im8-offwhite text-im8-burgundy/70 hover:bg-im8-stone/30"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Platform pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-im8-muted uppercase tracking-[0.05em] font-semibold">Platform</span>
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatforms(toggleIn(platforms, p))}
                className={`text-[11px] px-2 py-1 rounded-full font-medium transition-colors capitalize ${
                  platforms.includes(p)
                    ? "bg-im8-burgundy text-white"
                    : "bg-im8-offwhite text-im8-burgundy/70 hover:bg-im8-stone/30"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Expiring toggle */}
          <button
            onClick={() => setExpiringOnly(!expiringOnly)}
            className={`text-[11px] px-2 py-1 rounded-full font-medium transition-colors ${
              expiringOnly
                ? "bg-fuchsia-500 text-white"
                : "bg-im8-offwhite text-im8-burgundy/70 hover:bg-im8-stone/30"
            }`}
          >
            Expiring &lt; 30 days
          </button>

          {hasFilters && (
            <button onClick={clearAll} className="text-[11px] text-im8-red hover:underline ml-auto">
              Clear filters
            </button>
          )}
        </div>

        {allNiches.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-im8-muted uppercase tracking-[0.05em] font-semibold mr-1">Niche</span>
            {allNiches.map((n) => (
              <button
                key={n}
                onClick={() => setNiches(toggleIn(niches, n))}
                className={`text-[11px] px-2 py-1 rounded-full font-medium transition-colors ${
                  niches.includes(n)
                    ? "bg-im8-burgundy text-white"
                    : "bg-im8-offwhite text-im8-burgundy/70 hover:bg-im8-stone/30"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result summary + CSV */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-im8-muted">
          Showing <span className="font-semibold text-im8-burgundy">{filtered.length}</span> of {rows.length} creators
        </p>
        <button
          onClick={downloadCsv}
          className="text-[11px] font-bold uppercase tracking-[0.1em] text-im8-burgundy hover:text-im8-red transition-colors"
        >
          Download CSV ↓
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-white border-b border-im8-stone/30 sticky top-0 z-10">
              <tr className="text-left text-[11px] text-im8-muted uppercase tracking-[0.05em]">
                <Th onClick={() => toggleSort("influencerName")} sortKey="influencerName" current={sortKey} dir={sortDir}>Influencer</Th>
                <Th onClick={() => toggleSort("platform")} sortKey="platform" current={sortKey} dir={sortDir}>Platform</Th>
                <Th onClick={() => toggleSort("followerCount")} sortKey="followerCount" current={sortKey} dir={sortDir} align="right">Followers</Th>
                <th className="px-4 py-3 font-semibold">Niche</th>
                <Th onClick={() => toggleSort("monthlyRateCents")} sortKey="monthlyRateCents" current={sortKey} dir={sortDir} align="right">Monthly</Th>
                <Th onClick={() => toggleSort("totalRateCents")} sortKey="totalRateCents" current={sortKey} dir={sortDir} align="right">Total</Th>
                <Th onClick={() => toggleSort("campaignStart")} sortKey="campaignStart" current={sortKey} dir={sortDir}>Start</Th>
                <Th onClick={() => toggleSort("campaignEnd")} sortKey="campaignEnd" current={sortKey} dir={sortDir}>End</Th>
                <Th onClick={() => toggleSort("contractSequence")} sortKey="contractSequence" current={sortKey} dir={sortDir}>#</Th>
                <Th onClick={() => toggleSort("status")} sortKey="status" current={sortKey} dir={sortDir}>Status</Th>
                <th className="px-4 py-3 font-semibold">Progress</th>
                <th className="px-4 py-3 font-semibold">PIC</th>
                <th className="px-4 py-3 font-semibold">Drive</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-im8-stone/15">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-im8-muted">
                    {hasFilters ? "No creators match these filters." : "No active creators yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const days = daysUntil(getEnd(r));
                  const handle = handleFor(r);
                  return (
                    <tr key={r.id} className="hover:bg-im8-offwhite transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/deals/${r.id}`} className="font-semibold text-im8-burgundy hover:text-im8-red">
                          {r.influencerName}
                        </Link>
                        {r.agencyName && (
                          <div className="text-[11px] text-im8-muted">via {r.agencyName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="capitalize text-im8-burgundy">{r.platform ?? "—"}</div>
                        {handle && (
                          <div className="text-[11px] text-im8-muted truncate max-w-[120px]">@{handle}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-im8-burgundy">{formatCount(r.followerCount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {r.nicheTags.length === 0
                            ? <span className="text-im8-muted/50">—</span>
                            : r.nicheTags.slice(0, 3).map((t) => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-im8-offwhite text-im8-burgundy/70">
                                  {t}
                                </span>
                              ))}
                          {r.nicheTags.length > 3 && (
                            <span className="text-[10px] text-im8-muted">+{r.nicheTags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-im8-burgundy">{formatMoney(r.monthlyRateCents)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-im8-burgundy">
                        {formatMoney(r.totalRateCents)}
                        {r.totalMonths && (
                          <div className="text-[10px] text-im8-muted">{r.totalMonths}mo</div>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <DateCell
                          value={getStart(r)}
                          onChange={(v) => onChangeStart(r, v)}
                          saving={savingId === r.id}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <DateCell
                          value={getEnd(r)}
                          onChange={(v) => onChangeEnd(r, v)}
                          saving={savingId === r.id}
                        />
                        {days != null && days <= 30 && (
                          <div className={`inline-block ml-1 text-[10px] px-1 rounded font-semibold ${
                            days <= 7 ? "bg-red-100 text-red-700"
                              : days <= 14 ? "bg-amber-100 text-amber-800"
                              : "bg-im8-offwhite text-im8-muted"
                          }`}>
                            {days <= 0 ? "Expired" : `${days}d`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-im8-burgundy">#{r.contractSequence}</td>
                      <td className="px-4 py-3">
                        <span className={`px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold whitespace-nowrap ${STATUS_COLORS[r.status] ?? ""}`}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ProgressCell
                          done={r.deliverablesDone}
                          total={r.deliverablesTotal}
                          month={contractMonth(getStart(r), r.totalMonths)}
                        />
                      </td>
                      <td className="px-4 py-3 text-im8-burgundy/80 truncate max-w-[100px]">{r.pic ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.driveFolderId ? (
                          <a
                            href={`https://drive.google.com/drive/folders/${r.driveFolderId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Drive folder"
                            className="inline-flex items-center gap-1 text-[11px] text-im8-burgundy/50 hover:text-[#4285F4] transition-colors"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M4.5 19.5L9 12l4.5 7.5H4.5zM19.5 19.5l-3-7.5H12l3 7.5h4.5zM12 4.5L8.25 12h7.5L12 4.5z"/>
                            </svg>
                            Drive
                          </a>
                        ) : (
                          <span className="text-[11px] text-im8-burgundy/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`/admin/deals/${r.id}`} className="text-[11px] text-im8-muted hover:text-im8-red mr-3">
                          Open
                        </Link>
                        <Link href={`/admin/deals/new-contract?from=${r.id}`} className="text-[11px] font-semibold text-im8-red hover:underline">
                          Renew →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  sortKey,
  current,
  dir,
  align = "left",
}: {
  children: React.ReactNode;
  onClick: () => void;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  align?: "left" | "right";
}) {
  const active = sortKey === current;
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 font-semibold cursor-pointer select-none hover:text-im8-burgundy ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-im8-burgundy" : ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

/**
 * Inline date cell — shows "Set date" when null, formatted date when set.
 * Click to reveal a native date picker; saves on change.
 */
function DateCell({
  value,
  onChange,
  saving,
}: {
  value: string | null;
  onChange: (v: string) => void;
  saving: boolean;
}) {
  return (
    <label className="group relative inline-flex items-center cursor-pointer rounded-md hover:bg-im8-offwhite px-1.5 py-1 transition-colors">
      <span className={`text-[12px] tabular-nums ${value ? "text-im8-burgundy" : "text-im8-muted/60 italic"}`}>
        {value
          ? new Date(value).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" })
          : "Set date"}
      </span>
      {saving && <span className="ml-1.5 text-[9px] text-im8-muted">…</span>}
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
  );
}

/**
 * Compact progress display for the Roster:
 *   [▰▰▰░░] 3/5 done
 *   Month 2 of 3
 *
 * Shows nothing if there are no deliverables AND no contract dates.
 * "Month X of Y" only shown when start date + total months are set.
 */
function ProgressCell({
  done,
  total,
  month,
}: {
  done: number;
  total: number;
  month: { current: number; total: number } | null;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const allDone = total > 0 && done === total;

  if (total === 0 && !month) {
    return <span className="text-im8-muted/40 text-[11px]">—</span>;
  }

  return (
    <div className="flex flex-col gap-1 min-w-[110px]">
      {total > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-im8-stone/40 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${allDone ? "bg-emerald-500" : "bg-im8-burgundy"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-im8-burgundy tabular-nums">
            {done}/{total}
          </span>
        </div>
      )}
      {month && (
        <div className="text-[10px] text-im8-muted">
          Month {month.current} of {month.total}
        </div>
      )}
    </div>
  );
}
