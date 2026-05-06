"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ASSET_TYPES, type AssetType } from "@/lib/submissions/asset-types";

interface Deliverable {
  id: string;
  deliverable_type: string;
  sequence: number | null;
  status: string;
}

interface Deal {
  id: string;
  influencer_name: string;
  drive_folder_id: string | null;
  contract_sequence: number | null;
  deliverables: Deliverable[];
}

interface Props {
  deals: Deal[];
  preselectedDealId: string | null;
  preselectedDeliverableId: string | null;
}

interface SubmitResult {
  id: string;
  driveUrl: string;
  canonicalName: string;
  copied: boolean;
  assetCount: number;
  copiedCount: number;
  isScript?: boolean;
}

interface AssetRow {
  /** Stable React key — only used client-side. */
  key: string;
  asset_type: AssetType;
  drive_url: string;
  label: string;
}

let _rowSeq = 0;
function newRow(asset_type: AssetType = "full_reel"): AssetRow {
  _rowSeq += 1;
  return { key: `r${Date.now()}-${_rowSeq}`, asset_type, drive_url: "", label: "" };
}

function isDriveUrl(url: string): boolean {
  return url.includes("drive.google.com") || url.includes("docs.google.com");
}

export default function LogClient({ deals, preselectedDealId, preselectedDeliverableId }: Props) {
  // Partner search / selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [deliverableId, setDeliverableId] = useState<string>("");
  const [assets, setAssets] = useState<AssetRow[]>([newRow("full_reel")]);
  const [caption, setCaption] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [comment, setComment] = useState("");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Pre-fill from URL params
  useEffect(() => {
    if (preselectedDealId) {
      const deal = deals.find((d) => d.id === preselectedDealId);
      if (deal) {
        setSelectedDeal(deal);
        setSearchQuery(deal.influencer_name);
      }
    }
  }, [preselectedDealId, deals]);

  useEffect(() => {
    if (preselectedDeliverableId) {
      setDeliverableId(preselectedDeliverableId);
    }
  }, [preselectedDeliverableId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = deals.filter((d) =>
    d.influencer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function selectDeal(deal: Deal) {
    setSelectedDeal(deal);
    setSearchQuery(deal.influencer_name);
    setShowDropdown(false);
    setDeliverableId("");
  }

  function handleSearchChange(val: string) {
    setSearchQuery(val);
    setShowDropdown(true);
    if (selectedDeal && val !== selectedDeal.influencer_name) {
      setSelectedDeal(null);
    }
  }

  // ── Asset row helpers ──────────────────────────────────────────────────────
  function updateAsset(key: string, patch: Partial<AssetRow>) {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }
  function addAsset() {
    // Default new rows to Hook — that's the most common reason to add another
    // asset (extra hooks / variants on top of the primary full reel).
    setAssets((prev) => [...prev, newRow("hook")]);
  }
  function removeAsset(key: string) {
    setAssets((prev) => (prev.length === 1 ? prev : prev.filter((a) => a.key !== key)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedDeal) { setError("Please select a partner."); return; }
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (!a.drive_url.trim()) {
        setError(`Asset ${i + 1}: paste a Drive URL or remove the row.`);
        return;
      }
      if (!isDriveUrl(a.drive_url)) {
        setError(`Asset ${i + 1}: must be a Google Drive link.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: selectedDeal.id,
          deliverableId: deliverableId || undefined,
          caption: caption.trim() || undefined,
          postUrl: postUrl.trim() || undefined,
          comment: comment.trim() || undefined,
          assets: assets.map((a) => ({
            asset_type: a.asset_type,
            drive_url: a.drive_url.trim(),
            label: a.label.trim() || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to log submission");
      setResult(json as SubmitResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleAddAnother() {
    setResult(null);
    setError(null);
    // Keep partner + deliverable pre-filled for batch logging
    setAssets([newRow("full_reel")]);
    setCaption("");
    setPostUrl("");
    setComment("");
  }

  const deliverables = selectedDeal?.deliverables ?? [];

  // ─── Success state ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/admin/review" className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Review Queue</Link>
          <h1 className="text-2xl font-bold text-im8-burgundy">Log received content</h1>
        </div>

        <Card padding="lg" className="max-w-xl">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-im8-burgundy">
                Added to review queue ({result.assetCount} asset{result.assetCount === 1 ? "" : "s"})
              </p>
              <p className="text-sm text-im8-burgundy/60 mt-1">
                Primary file: <span className="font-mono text-xs bg-im8-sand/60 px-1.5 py-0.5 rounded">{result.canonicalName}</span>
              </p>
              {result.copiedCount > 0 ? (
                <p className="text-xs text-emerald-700 mt-1">
                  ✓ {result.copiedCount} of {result.assetCount} asset{result.assetCount === 1 ? "" : "s"} copied to partner&apos;s Drive folder
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-1">⚠ Could not copy to partner folder — original Drive link saved</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <Button onClick={handleAddAnother} size="sm" variant="primary">Log another submission</Button>
            <Link
              href="/admin/review"
              className="inline-flex items-center gap-1 text-sm text-im8-red hover:underline font-medium"
            >
              View in queue →
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/review" className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Review Queue</Link>
        <h1 className="text-2xl font-bold text-im8-burgundy">Log received content</h1>
        <p className="text-sm text-im8-burgundy/60 mt-1">
          Paste Drive links for content received outside the portal. Multiple assets (hooks, body, full reels) all roll up under <span className="font-medium">one</span> review card.
        </p>
      </div>

      <Card padding="lg" className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Partner search */}
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1.5">
              Partner <span className="text-im8-red">*</span>
            </label>
            <div className="relative" ref={searchRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search by name…"
                className="w-full px-3 py-2 border border-im8-stone/50 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30"
                autoComplete="off"
              />
              {selectedDeal && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {showDropdown && searchQuery && filtered.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-lg border border-im8-stone/40 shadow-lg max-h-64 overflow-y-auto">
                  {filtered.slice(0, 20).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-im8-burgundy hover:bg-im8-offwhite border-b border-im8-stone/20 last:border-0"
                      onMouseDown={() => selectDeal(d)}
                    >
                      {d.influencer_name}
                      {d.contract_sequence ? (
                        <span className="ml-2 text-xs text-im8-burgundy/40">Contract {d.contract_sequence}</span>
                      ) : null}
                    </button>
                  ))}
                  {filtered.length > 20 && (
                    <div className="px-3 py-2 text-xs text-im8-burgundy/40 italic">
                      {filtered.length - 20} more — type to narrow results
                    </div>
                  )}
                </div>
              )}
              {showDropdown && searchQuery && filtered.length === 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-lg border border-im8-stone/40 shadow-sm px-3 py-2 text-sm text-im8-burgundy/50">
                  No partners found
                </div>
              )}
            </div>
          </div>

          {/* Deliverable picker */}
          {selectedDeal && (
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1.5">
                Deliverable <span className="text-im8-burgundy/40 font-normal">(optional)</span>
              </label>
              <select
                value={deliverableId}
                onChange={(e) => setDeliverableId(e.target.value)}
                className="w-full px-3 py-2 border border-im8-stone/50 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 bg-white"
              >
                <option value="">— No specific deliverable —</option>
                {deliverables
                  .sort((a, b) => {
                    const typeCompare = (a.deliverable_type ?? "").localeCompare(b.deliverable_type ?? "");
                    if (typeCompare !== 0) return typeCompare;
                    return (a.sequence ?? 0) - (b.sequence ?? 0);
                  })
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.deliverable_type}{d.sequence ? ` #${d.sequence}` : ""}{" "}
                      ({d.status})
                    </option>
                  ))}
              </select>
              {deliverables.length === 0 && (
                <p className="text-xs text-im8-burgundy/40 mt-1">No deliverables set up for this deal yet.</p>
              )}
            </div>
          )}

          {/* Assets — one or more */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="block text-sm font-medium text-im8-burgundy">
                Assets <span className="text-im8-red">*</span>
              </label>
              <span className="text-xs text-im8-burgundy/50">
                {assets.length} asset{assets.length === 1 ? "" : "s"} — primary first
              </span>
            </div>
            <div className="space-y-3">
              {assets.map((a, i) => (
                <div
                  key={a.key}
                  className="rounded-lg border border-im8-stone/40 bg-im8-offwhite/40 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-im8-burgundy text-white text-[10px] font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <select
                      value={a.asset_type}
                      onChange={(e) => updateAsset(a.key, { asset_type: e.target.value as AssetType })}
                      className="px-2 py-1 border border-im8-stone/50 rounded-md text-sm text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30"
                    >
                      {ASSET_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}{i === 0 && t.value === "full_reel" ? " (primary)" : ""}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={a.label}
                      onChange={(e) => updateAsset(a.key, { label: e.target.value })}
                      placeholder='Optional label e.g. "Hook 1"'
                      className="flex-1 min-w-0 px-2 py-1 border border-im8-stone/50 rounded-md text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30"
                    />
                    {assets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAsset(a.key)}
                        className="text-im8-burgundy/40 hover:text-red-600 p-1 flex-shrink-0"
                        title="Remove asset"
                        aria-label="Remove asset"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={a.drive_url}
                    onChange={(e) => updateAsset(a.key, { drive_url: e.target.value })}
                    placeholder={a.asset_type === "drive_folder"
                      ? "https://drive.google.com/drive/folders/…"
                      : "https://drive.google.com/file/d/…"}
                    className="w-full px-2 py-1.5 border border-im8-stone/50 rounded-md text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 font-mono"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addAsset}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-im8-red hover:text-im8-burgundy"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add another asset
            </button>
            <p className="text-xs text-im8-burgundy/40 mt-2 leading-relaxed">
              Each asset is copied into the partner&apos;s Drive folder and renamed automatically.
              Drive Folder assets keep their original URL (folders can&apos;t be cloned).
            </p>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1.5">
              Caption <span className="text-im8-burgundy/40 font-normal">(optional)</span>
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              maxLength={2200}
              placeholder="Paste the creator's caption here if they sent one…"
              className="w-full px-3 py-2 border border-im8-stone/50 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
            />
            <p className="text-xs text-im8-burgundy/40 mt-0.5 text-right">{caption.length}/2200</p>
          </div>

          {/* Internal note / comment */}
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1.5">
              Note / comment <span className="text-im8-burgundy/40 font-normal">(optional, internal)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="e.g. 'Came in via email — Sam forwarded, 7 assets attached as one IGR.'"
              className="w-full px-3 py-2 border border-im8-stone/50 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
            />
            <p className="text-xs text-im8-burgundy/40 mt-1">
              Posts as an internal comment on the deliverable thread (only visible to the team).
              {!deliverableId && <span className="text-amber-600"> Pick a deliverable above to enable.</span>}
            </p>
          </div>

          {/* Post URL */}
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1.5">
              Post URL <span className="text-im8-burgundy/40 font-normal">(optional — only if already live)</span>
            </label>
            <input
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/…"
              className="w-full px-3 py-2 border border-im8-stone/50 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!selectedDeal || assets.some((a) => !a.drive_url.trim())}
            >
              Add to review queue
            </Button>
            <Link href="/admin/review" className="text-sm text-im8-burgundy/50 hover:text-im8-burgundy">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
