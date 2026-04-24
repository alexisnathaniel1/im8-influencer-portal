"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const DELIVERABLE_LABELS: Record<string, string> = {
  IGR: "Instagram Reels",
  IGS: "Instagram Stories",
  UGC: "UGC Videos",
  TIKTOK: "TikTok Videos",
  YT: "YouTube Videos",
  WHITELIST: "Whitelisting",
};

interface Brief {
  id: string;
  deal_id: string;
  title: string;
  body_markdown: string;
  google_doc_url: string | null;
  platform: string | null;
  deliverable_type: string | null;
  due_date: string | null;
  status: string;
  deal: {
    influencer_name: string;
    platform_primary: string;
    contract_sequence: number | null;
    total_months: number | null;
    monthly_rate_cents: number | null;
    is_gifted: boolean | null;
    deliverables: Array<{ code: string; count: number }> | null;
  } | null;
}

export default function BriefEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [googleDocUrl, setGoogleDocUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [urlError, setUrlError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("briefs")
      .select(`
        *,
        deal:deal_id(
          influencer_name, platform_primary, contract_sequence,
          total_months, monthly_rate_cents, is_gifted, deliverables
        )
      `)
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setBrief(data as unknown as Brief);
          setBody(data.body_markdown || "");
          setTitle(data.title || "");
          setGoogleDocUrl(data.google_doc_url || "");
        }
      });
  }, [id]);

  function validateGoogleDocUrl(url: string): string {
    if (!url.trim()) return "";
    try {
      const u = new URL(url.trim());
      if (!u.hostname.includes("google.com") && !u.hostname.includes("goo.gl")) {
        return "Must be a Google Docs / Drive link";
      }
      return "";
    } catch {
      return "That doesn't look like a valid URL";
    }
  }

  async function handleSave() {
    const err = validateGoogleDocUrl(googleDocUrl);
    setUrlError(err);
    if (err) return;
    setSaving(true);
    await fetch(`/api/briefs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body_markdown: body, google_doc_url: googleDocUrl || null }),
    });
    setSaving(false);
    setMessage("Saved");
    setTimeout(() => setMessage(""), 2000);
  }

  async function handleSend() {
    const err = validateGoogleDocUrl(googleDocUrl);
    setUrlError(err);
    if (err) return;
    if (!googleDocUrl.trim()) {
      setUrlError("Add the Google Docs link before sending.");
      return;
    }
    setSending(true);
    await fetch(`/api/briefs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, body_markdown: body, google_doc_url: googleDocUrl,
        status: "sent", sent_at: new Date().toISOString(),
      }),
    });
    setBrief((prev) => prev ? { ...prev, status: "sent" } : prev);
    setSending(false);
    setMessage("Brief sent to influencer");
    setTimeout(() => setMessage(""), 3000);
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-im8-offwhite flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-im8-red border-t-transparent rounded-full" />
      </div>
    );
  }

  const deal = brief.deal;
  const deliverables = (deal?.deliverables ?? []).filter(d => d && d.code);
  const rateUsd = deal?.monthly_rate_cents ? deal.monthly_rate_cents / 100 : null;

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href={`/admin/deals/${brief.deal_id}`} className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Back to Deal</Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-im8-burgundy">{title || "Content Brief"}</h1>
              {deal && (
                <p className="text-sm text-im8-burgundy/60">
                  {deal.influencer_name} · {deal.platform_primary}
                  {deal.contract_sequence && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">Contract {deal.contract_sequence}</span>}
                </p>
              )}
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${brief.status === "sent" ? "bg-blue-100 text-blue-700" : brief.status === "draft" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
              {brief.status}
            </span>
          </div>
        </div>

        {/* Contract & deliverables auto-summary */}
        {deal && (
          <Card padding="md" className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-im8-burgundy">Contract & deliverables</h3>
              <span className="text-xs text-im8-burgundy/40">Auto-filled from the deal — edit on the Partner Tracker.</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
              <div>
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide">Contract</div>
                <div className="text-im8-burgundy font-medium">Contract {deal.contract_sequence ?? 1}</div>
              </div>
              <div>
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide">Duration</div>
                <div className="text-im8-burgundy font-medium">{deal.total_months ?? 3} months</div>
              </div>
              <div>
                <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide">Rate</div>
                <div className="text-im8-burgundy font-medium">
                  {deal.is_gifted ? "Gifted" : rateUsd ? `$${rateUsd.toLocaleString()}/mo` : "—"}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-im8-burgundy/50 uppercase tracking-wide mb-2">Confirmed deliverables</div>
              {deliverables.length === 0 ? (
                <p className="text-sm text-im8-burgundy/40 italic">
                  No deliverables confirmed on the deal yet. Update them on the Partner Tracker before sending this brief.
                </p>
              ) : (
                <ul className="space-y-1">
                  {deliverables.map((d, i) => (
                    <li key={i} className="text-sm text-im8-burgundy flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-im8-red/10 text-im8-red font-semibold w-10 text-center">
                        {d.count}×
                      </span>
                      {DELIVERABLE_LABELS[d.code] ?? d.code}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        )}

        {/* Brief content — Google Doc link is the primary deliverable */}
        <Card padding="md" className="mb-4">
          <div className="mb-4">
            <Input label="Brief Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-im8-burgundy mb-1">
              Google Docs link <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-im8-burgundy/50 mb-2">
              Write the brief in Google Docs and paste the shareable link here. Make sure it&apos;s set to
              &ldquo;Anyone with the link — Viewer&rdquo; (or &ldquo;Commenter&rdquo;).
            </p>
            <input
              type="url"
              value={googleDocUrl}
              onChange={(e) => { setGoogleDocUrl(e.target.value); setUrlError(""); }}
              placeholder="https://docs.google.com/document/d/…"
              className={`w-full px-3 py-2 border rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 ${urlError ? "border-red-300 bg-red-50" : "border-im8-sand"}`}
            />
            {urlError && <p className="text-xs text-red-600 mt-1">{urlError}</p>}
            {googleDocUrl && !urlError && (
              <a href={googleDocUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-im8-red hover:underline mt-1 inline-block">
                Open doc ↗
              </a>
            )}
          </div>

          <details className="mt-4">
            <summary className="text-xs text-im8-burgundy/60 cursor-pointer hover:text-im8-burgundy select-none">
              Optional: add inline notes for the creator (legacy markdown body)
            </summary>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Optional — short context or reminder. Put the actual brief in the Google Doc."
              className="mt-2 w-full text-sm font-mono border border-im8-sand rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-y"
            />
          </details>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} loading={saving}>Save Draft</Button>
            {brief.status === "draft" && (
              <Button variant="secondary" onClick={handleSend} loading={sending}>
                Send to Influencer
              </Button>
            )}
          </div>
          {message && <p className="text-sm text-im8-burgundy/60">{message}</p>}
        </div>
      </div>
    </div>
  );
}
