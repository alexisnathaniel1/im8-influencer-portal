"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PARTNER_COLUMNS,
  buildPartnersTemplateCsv,
  parseCsv,
  mapHeaderToKey,
  validateRow,
  type ParsedPartnerRow,
  type PartnerColumnKey,
} from "@/lib/csv/partners-template";

export default function BulkUploadPage() {
  const [parsed, setParsed] = useState<ParsedPartnerRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    deliverablesCreated?: number;
    markedLive?: number;
    skipped: { email: string; reason: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function downloadTemplate() {
    const csv = buildPartnersTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "im8-partners-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setError(null);
    const text = await file.text();
    const matrix = parseCsv(text);
    if (matrix.length < 2) {
      setError("CSV is empty or has only a header row.");
      setParsed([]);
      return;
    }
    const headerRow = matrix[0];
    const headerKeys: (PartnerColumnKey | null)[] = headerRow.map(mapHeaderToKey);

    const dataRows = matrix.slice(1);
    const rows: ParsedPartnerRow[] = dataRows.map((cells, idx) => {
      const raw: Record<string, string> = {};
      headerKeys.forEach((key, i) => {
        if (key) raw[key] = cells[i] ?? "";
      });
      return validateRow(raw, idx + 2); // +2 because row 1 is header, rows are 1-indexed
    });
    setParsed(rows);
  }

  async function importValid() {
    const valid = parsed.filter(r => r.errors.length === 0 && r.payload).map(r => r.payload!);
    if (valid.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/deals/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: valid }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
      } else {
        setResult({
          inserted: data.inserted,
          deliverablesCreated: data.deliverablesCreated,
          markedLive: data.markedLive,
          skipped: data.skipped ?? [],
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const validCount = parsed.filter(r => r.errors.length === 0).length;
  const errorCount = parsed.length - validCount;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link href="/admin/deals" className="text-sm text-im8-red hover:underline mb-2 inline-block">
          ← Back to Partner Tracker
        </Link>
        <h1 className="text-3xl font-bold text-im8-burgundy">Bulk upload partners</h1>
        <p className="text-im8-burgundy/60 mt-1 text-sm">
          Download the template, fill it in for each partner, then upload it back here. Existing partners (matched by email) are skipped automatically.
        </p>
      </div>

      {/* Step 1 — template */}
      <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-im8-muted mb-1">Step 1</p>
            <h2 className="text-lg font-bold text-im8-burgundy">Download the template</h2>
            <p className="text-sm text-im8-burgundy/60 mt-1">
              {PARTNER_COLUMNS.length} columns including required fields, deliverables, dates and rates.
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 bg-im8-burgundy text-white text-sm rounded-full hover:bg-im8-red transition-colors flex items-center gap-2 font-bold uppercase tracking-[0.05em] text-[12px]"
          >
            ↓ Download CSV template
          </button>
        </div>
        <details className="border-t border-im8-stone/20 pt-4">
          <summary className="text-sm text-im8-muted cursor-pointer hover:text-im8-burgundy">
            Show column reference
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[11px] text-im8-muted uppercase tracking-[0.05em]">
                  <th className="px-3 py-2 font-semibold">Column</th>
                  <th className="px-3 py-2 font-semibold">Required</th>
                  <th className="px-3 py-2 font-semibold">Format</th>
                  <th className="px-3 py-2 font-semibold">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-im8-stone/15">
                {PARTNER_COLUMNS.map(c => (
                  <tr key={c.key}>
                    <td className="px-3 py-2 font-semibold text-im8-burgundy">{c.label}</td>
                    <td className="px-3 py-2">{c.required ? <span className="text-im8-red font-bold">Yes</span> : <span className="text-im8-muted/50">—</span>}</td>
                    <td className="px-3 py-2 text-im8-burgundy/70">{c.hint}</td>
                    <td className="px-3 py-2 text-im8-muted font-mono text-[11px]">{c.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      {/* Step 2 — upload */}
      <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-im8-muted mb-1">Step 2</p>
          <h2 className="text-lg font-bold text-im8-burgundy">Upload your filled-in CSV</h2>
        </div>

        <label className="block">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="block w-full text-sm text-im8-burgundy file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[12px] file:font-bold file:uppercase file:tracking-[0.05em] file:bg-im8-burgundy file:text-white hover:file:bg-im8-red file:cursor-pointer"
          />
        </label>

        {fileName && parsed.length > 0 && (
          <div className="text-sm text-im8-burgundy/70">
            <span className="font-semibold">{fileName}</span> — {parsed.length} rows ·{" "}
            <span className="text-emerald-700 font-semibold">{validCount} valid</span>
            {errorCount > 0 && (
              <>
                {" · "}
                <span className="text-im8-red font-semibold">{errorCount} with errors</span>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>

      {/* Step 3 — preview */}
      {parsed.length > 0 && (
        <div className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
          <div className="px-6 py-4 border-b border-im8-stone/20 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-im8-muted mb-1">Step 3</p>
              <h2 className="text-lg font-bold text-im8-burgundy">Preview & import</h2>
            </div>
            <button
              onClick={importValid}
              disabled={validCount === 0 || uploading || !!result}
              className="px-4 py-2 bg-emerald-600 text-white text-[12px] font-bold uppercase tracking-[0.05em] rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading && <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {uploading ? "Importing…" : `Import ${validCount} valid ${validCount === 1 ? "partner" : "partners"}`}
            </button>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-[12px]">
              <thead className="bg-im8-offwhite sticky top-0 z-10">
                <tr className="text-left text-[11px] text-im8-muted uppercase tracking-[0.05em]">
                  <th className="px-3 py-2 font-semibold">Row</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Influencer</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Agency</th>
                  <th className="px-3 py-2 font-semibold">Platform</th>
                  <th className="px-3 py-2 font-semibold text-right">Followers</th>
                  <th className="px-3 py-2 font-semibold text-right">Monthly</th>
                  <th className="px-3 py-2 font-semibold">Months</th>
                  <th className="px-3 py-2 font-semibold">Deliverables</th>
                  <th className="px-3 py-2 font-semibold">Already done</th>
                  <th className="px-3 py-2 font-semibold">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-im8-stone/15">
                {parsed.map(r => {
                  const ok = r.errors.length === 0;
                  return (
                    <tr key={r.rowIndex} className={ok ? "" : "bg-red-50/30"}>
                      <td className="px-3 py-2 text-im8-muted">#{r.rowIndex}</td>
                      <td className="px-3 py-2">
                        {ok ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700">
                            Error
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold text-im8-burgundy">{r.raw.influencer_name || "—"}</td>
                      <td className="px-3 py-2 text-im8-burgundy/70">{r.raw.influencer_email || "—"}</td>
                      <td className="px-3 py-2 text-im8-burgundy/70">{r.raw.agency_name || "—"}</td>
                      <td className="px-3 py-2 text-im8-burgundy/70 capitalize">{r.payload?.platform_primary ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-im8-burgundy/80">
                        {r.payload?.follower_count?.toLocaleString() ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-im8-burgundy/80">
                        {r.payload?.monthly_rate_cents != null ? `$${(r.payload.monthly_rate_cents / 100).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-im8-burgundy/80">{r.payload?.total_months ?? "—"}</td>
                      <td className="px-3 py-2 text-im8-burgundy/70 text-[11px]">
                        {(r.payload?.deliverables ?? []).map(d => `${d.code}×${d.count}`).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-emerald-700 text-[11px]">
                        {(r.payload?.completed_deliverables ?? []).length > 0
                          ? r.payload!.completed_deliverables.map(d => `${d.code}×${d.count}`).join(", ")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-red-700 text-[11px]">
                        {r.errors.map(e => `${e.field}: ${e.message}`).join("; ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-5">
          <h3 className="text-lg font-bold text-emerald-900 mb-2">
            ✓ Imported {result.inserted} {result.inserted === 1 ? "partner" : "partners"}
          </h3>
          {(result.deliverablesCreated ?? 0) > 0 && (
            <p className="text-sm text-emerald-800 mb-1">
              Created {result.deliverablesCreated} tracker {result.deliverablesCreated === 1 ? "row" : "rows"}
              {(result.markedLive ?? 0) > 0 && <> · {result.markedLive} marked already-live</>}.
            </p>
          )}
          {result.skipped.length > 0 && (
            <p className="text-sm text-emerald-800">
              Skipped {result.skipped.length} duplicate{result.skipped.length === 1 ? "" : "s"}: {result.skipped.map(s => s.email).join(", ")}
            </p>
          )}
          <button
            onClick={() => router.push("/admin/deals")}
            className="mt-3 px-4 py-2 bg-im8-burgundy text-white text-[12px] font-bold uppercase tracking-[0.05em] rounded-full hover:bg-im8-red transition-colors"
          >
            View Partner Tracker →
          </button>
        </div>
      )}
    </div>
  );
}
