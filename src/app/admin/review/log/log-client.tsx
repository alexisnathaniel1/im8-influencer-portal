"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
}

export default function LogClient({ deals, preselectedDealId, preselectedDeliverableId }: Props) {
  // Partner search / selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [deliverableId, setDeliverableId] = useState<string>("");
  const [driveUrl, setDriveUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [postUrl, setPostUrl] = useState("");

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
    setDeliverableId(""); // reset deliverable when partner changes
  }

  function handleSearchChange(val: string) {
    setSearchQuery(val);
    setShowDropdown(true);
    if (selectedDeal && val !== selectedDeal.influencer_name) {
      setSelectedDeal(null); // clear selection if user edits the name
    }
  }

  function isDriveUrl(url: string): boolean {
    return url.includes("drive.google.com") || url.includes("docs.google.com");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedDeal) { setError("Please select a partner."); return; }
    if (!driveUrl.trim()) { setError("Please enter a Drive URL."); return; }
    if (!isDriveUrl(driveUrl)) { setError("URL must be a Google Drive link (drive.google.com)."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: selectedDeal.id,
          deliverableId: deliverableId || undefined,
          driveUrl: driveUrl.trim(),
          caption: caption.trim() || undefined,
          postUrl: postUrl.trim() || undefined,
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
    setDriveUrl("");
    setCaption("");
    setPostUrl("");
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
              <p className="font-semibold text-im8-burgundy">Added to review queue</p>
              <p className="text-sm text-im8-burgundy/60 mt-1">
                File: <span className="font-mono text-xs bg-im8-sand/60 px-1.5 py-0.5 rounded">{result.canonicalName}</span>
              </p>
              {result.copied ? (
                <p className="text-xs text-emerald-700 mt-1">✓ Copied to partner's Drive folder and renamed</p>
              ) : (
                <p className="text-xs text-amber-600 mt-1">⚠ Could not copy to partner folder — original Drive link saved</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <Button onClick={handleAddAnother} size="sm" variant="primary">Add another</Button>
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
          Paste a Drive link for content received outside the portal. It will be copied to the partner's folder and added to the review queue.
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

          {/* Deliverable picker — only shown when a deal is selected */}
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

          {/* Drive URL */}
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1.5">
              Drive URL <span className="text-im8-red">*</span>
            </label>
            <input
              type="url"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/…"
              className="w-full px-3 py-2 border border-im8-stone/50 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 font-mono"
            />
            <p className="text-xs text-im8-burgundy/40 mt-1">
              The file will be copied to the partner's Drive folder and renamed automatically.
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
              disabled={!selectedDeal || !driveUrl.trim()}
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
