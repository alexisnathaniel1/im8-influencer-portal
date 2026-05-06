"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NicheMultiSelect from "@/components/shared/niche-multi-select";
import DeliverableComments from "@/components/deliverables/deliverable-comments";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";
import { DELIVERABLE_LABELS, BINARY_DELIVERABLE_CODES } from "@/lib/deliverables";

type Deal = Record<string, unknown>;
type Brief = Record<string, unknown>;
type Submission = Record<string, unknown>;

interface GiftingRequest {
  id: string;
  recipient_name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country: string;
  phone: string | null;
  products: Array<{ name: string; qty: number }>;
  im8hub_status: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  notes: string | null;
  created_at: string;
}

interface ShippingAddress {
  recipient_name?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface SavedAddress {
  id: string;
  label: string;
  is_primary: boolean;
  is_legacy?: boolean;
  recipient_name: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

const STATUS_FLOW = ["contacted", "negotiating", "agreed", "pending_approval", "approved", "contracted", "live", "completed"];

type DeliverableRow = {
  id: string;
  deliverable_type: string;
  sequence: number | null;
  title: string | null;
  status: string;
  due_date: string | null;
  brief_doc_url: string | null;
  brief_sent_at: string | null;
  admin_review_due_date: string | null;
  brief_sent_by: { full_name: string } | null;
};

export type ManagementFeedbackEntry = {
  id: string;
  author_display_name: string | null;
  body: string;
  kind: string;
  created_at: string;
  packet_id: string;
};

export default function DealDetailClient({
  deal, briefs, submissions, giftingRequests, deliverables = [], partnerShippingAddress, canViewRates = false, role = "", managementFeedback = [], completedDeliverables = 0, totalDeliverables = 0,
}: {
  deal: Deal;
  briefs: Brief[];
  submissions: Submission[];
  giftingRequests: GiftingRequest[];
  deliverables?: DeliverableRow[];
  partnerShippingAddress: ShippingAddress | null;
  canViewRates?: boolean;
  role?: string;
  managementFeedback?: ManagementFeedbackEntry[];
  completedDeliverables?: number;
  totalDeliverables?: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "contract" | "briefs" | "submissions" | "gifting" | "edited-videos">("overview");

  // Auto-sync missing tracker rows whenever the Briefs tab is opened.
  // Handles the case where deliverables were added to the contract AFTER the
  // initial auto-populate (e.g. deal started with IGR×1, later updated to IGR×3).
  // Excludes rights/extras (WHITELIST etc.) from the expected count — they
  // don't get tracker rows, so including them would trigger a wasted sync call
  // every time the tab opens.
  useEffect(() => {
    if (tab !== "briefs") return;
    const dealDeliverables = ((deal.deliverables as Array<{ code: string; count: number }> | null) ?? [])
      .filter(d => d?.code && d.count > 0 && !BINARY_DELIVERABLE_CODES.has(d.code));
    const expectedCount = dealDeliverables.reduce((s, d) => s + d.count, 0);
    if (expectedCount <= deliverables.length) return; // all tracker rows exist already
    fetch(`/api/deals/${deal.id}/sync-deliverables`, { method: "POST" })
      .then(r => r.json())
      .then(j => { if ((j.created ?? 0) > 0) router.refresh(); })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creatingBrief, setCreatingBrief] = useState(false);
  const [briefCreateError, setBriefCreateError] = useState("");
  const [form, setForm] = useState({
    influencerName: (deal.influencer_name as string) ?? "",
    influencerEmail: (deal.influencer_email as string) ?? "",
    agencyName: (deal.agency_name as string) ?? "",
    platformPrimary: (deal.platform_primary as string) ?? "instagram",
    rationale: (deal.rationale as string) ?? "",
    igHandle: (deal.instagram_handle as string) ?? "",
    tiktokHandle: (deal.tiktok_handle as string) ?? "",
    youtubeHandle: (deal.youtube_handle as string) ?? "",
    followerCount: deal.follower_count ? String(deal.follower_count) : "",
    nicheTags: (deal.niche_tags as string[] | null) ?? [],
    creatorBio: (deal.creator_bio as string) ?? "",
    needsApproval: deal.needs_approval !== false,
    discountCode: (deal.discount_code as string) ?? "",
    affiliateLink: (deal.affiliate_link as string) ?? "",
  });

  const [contract, setContract] = useState({
    campaignStart: (deal.campaign_start as string) ?? "",
    campaignEnd: (deal.campaign_end as string) ?? "",
    contractUrl: (deal.contract_url as string) ?? "",
    paymentTerms: (deal.payment_terms as string) ?? "",
    contractRequirements: (deal.contract_requirements as string) ?? "",
    usageRightsMonths: String(deal.usage_rights_months ?? 12),
  });
  const [savingContract, setSavingContract] = useState(false);
  const [savedContract, setSavedContract] = useState(false);

  async function saveContract() {
    setSavingContract(true);
    await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_start: contract.campaignStart || null,
        campaign_end: contract.campaignEnd || null,
        contract_url: contract.contractUrl || null,
        payment_terms: contract.paymentTerms || null,
        contract_requirements: contract.contractRequirements || null,
        usage_rights_months: parseInt(contract.usageRightsMonths) || 12,
      }),
    });
    router.refresh();
    setSavingContract(false);
    setSavedContract(true);
    setTimeout(() => setSavedContract(false), 2500);
  }

  async function saveOverview() {
    setSaving(true);
    await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        influencer_name: form.influencerName,
        influencer_email: form.influencerEmail,
        agency_name: form.agencyName || null,
        platform_primary: form.platformPrimary,
        rationale: form.rationale,
        instagram_handle: form.igHandle.trim().replace(/^@/, "") || null,
        tiktok_handle: form.tiktokHandle.trim().replace(/^@/, "") || null,
        youtube_handle: form.youtubeHandle.trim().replace(/^@/, "") || null,
        follower_count: form.followerCount ? parseInt(form.followerCount) : null,
        niche_tags: form.nicheTags,
        creator_bio: form.creatorBio || null,
        needs_approval: form.needsApproval,
        discount_code: form.discountCode || null,
        affiliate_link: form.affiliateLink || null,
      }),
    });
    router.refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function markAgreed() {
    // Save current form state first so mark-agreed validates against fresh data
    await saveOverview();
    const res = await fetch(`/api/deals/${deal.id}/mark-agreed`, { method: "POST" });
    if (!res.ok) {
      const { error } = await res.json();
      alert(error || "Could not mark as agreed. Fill in all required fields first.");
      return;
    }
    router.refresh();
  }

  const statusColors: Record<string, string> = {
    contacted: "bg-gray-100 text-gray-600",
    negotiating: "bg-blue-100 text-blue-700",
    agreed: "bg-yellow-100 text-yellow-700",
    pending_approval: "bg-orange-100 text-orange-700",
    approved: "bg-green-100 text-green-700",
    live: "bg-emerald-100 text-emerald-700",
  };

  const status = deal.status as string;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="bg-white rounded-xl border border-im8-stone/30 px-5 pt-4 pb-4 space-y-4">
        {/* Pipeline — all stages visible, wraps on small screens */}
        <div className="flex flex-wrap items-center gap-y-2">
          {STATUS_FLOW.map((s, i) => {
            const currentIdx = STATUS_FLOW.indexOf(status);
            const isDone = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div key={s} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? "bg-im8-red" : isDone ? "bg-emerald-500" : "bg-im8-stone/60"}`} />
                  <span className={`text-[12px] capitalize whitespace-nowrap ${isCurrent ? "font-bold text-im8-burgundy" : isDone ? "font-medium text-emerald-600" : "text-im8-burgundy/35"}`}>
                    {s.replace(/_/g, " ")}
                  </span>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <span className="mx-2 text-im8-stone/40 text-xs select-none">›</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions row — override + advance button */}
        <div className="flex items-center justify-between gap-3 border-t border-im8-stone/20 pt-3">
          {role === "admin" ? (
            <StatusOverrideSelect status={status} dealId={deal.id as string} onRefresh={() => router.refresh()} />
          ) : (
            <div />
          )}
          <StageButton status={status} dealId={deal.id as string} onRefresh={() => router.refresh()} onMarkAgreed={markAgreed} needsApproval={form.needsApproval} role={role} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-im8-sand/50 rounded-xl p-1 w-fit flex-wrap">
        {(["overview", "contract", "briefs", "submissions", "gifting", "edited-videos"] as const)
          .filter(t => role === "support" ? !["contract", "gifting"].includes(t) : true)
          .map(t => {
            const label: Record<string, string> = {
              overview: "Overview", contract: "Contract", briefs: "Briefs",
              submissions: "Submissions", gifting: "Gifting", "edited-videos": "Edited Videos",
            };
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? "bg-white text-im8-burgundy shadow-sm" : "text-im8-burgundy/50 hover:text-im8-burgundy"
                }`}>
                {label[t]}
                {t === "briefs" && (() => {
                  // Total schedulable briefs (excludes WHITELIST etc.)
                  const total = ((deal.deliverables as Array<{ code: string; count: number }> | null) ?? [])
                    .filter(d => d && d.code && d.count > 0 && !BINARY_DELIVERABLE_CODES.has(d.code))
                    .reduce((s, d) => s + d.count, 0);
                  // Outstanding = total minus tracker rows already approved/live/completed,
                  // since "already done" deliverables don't need a brief sent.
                  const alreadyDone = (deliverables ?? []).filter(d =>
                    ["approved", "live", "completed"].includes((d as Record<string, unknown>).status as string)
                  ).length;
                  const outstanding = Math.max(0, total - alreadyDone);
                  return total > 0 ? <span className="ml-1 text-xs">({outstanding}/{total})</span> : null;
                })()}
                {t === "submissions" && submissions.length > 0 && <span className="ml-1 text-xs">({submissions.length})</span>}
              </button>
            );
          })}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-5">

          {/* ── Card 1: Influencer ── */}
          <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-5">
            <h3 className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.1em]">Influencer</h3>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Influencer name *" value={form.influencerName}
                onChange={v => setForm(f => ({ ...f, influencerName: v }))} />
              <div>
                <Field label="Email" value={form.influencerEmail}
                  onChange={v => setForm(f => ({ ...f, influencerEmail: v }))} type="email" />
                {form.influencerEmail && (
                  <InviteButton
                    email={form.influencerEmail}
                    dealId={deal.id as string}
                    alreadyLinked={Boolean(deal.influencer_profile_id)}
                  />
                )}
              </div>
              <Field label="Agency" value={form.agencyName}
                onChange={v => setForm(f => ({ ...f, agencyName: v }))} />
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Platform</label>
                <select value={form.platformPrimary} onChange={e => setForm(f => ({ ...f, platformPrimary: e.target.value }))}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none">
                  {["instagram", "tiktok", "youtube", "facebook", "other"].map(p => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Instagram", key: "igHandle" as const, prefix: "instagram.com/" },
                { label: "TikTok", key: "tiktokHandle" as const, prefix: "tiktok.com/@" },
                { label: "YouTube", key: "youtubeHandle" as const, prefix: "youtube.com/@" },
              ].map(({ label, key, prefix }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">{label}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form[key]}
                      placeholder="@handle"
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                    />
                    {form[key] && (
                      <a
                        href={`https://${prefix}${form[key].replace(/^@/, "")}`}
                        target="_blank" rel="noopener noreferrer"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-im8-red hover:underline">
                        ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Followers (approx)</label>
                <input type="number" value={form.followerCount} placeholder="50000"
                  onChange={e => setForm(f => ({ ...f, followerCount: e.target.value }))}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Niche tags</label>
                <NicheMultiSelect
                  value={form.nicheTags}
                  onChange={next => setForm(f => ({ ...f, nicheTags: next }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">
                Creator bio <span className="text-im8-burgundy/40 font-normal">(2–3 sentences — shown on review cards for reviewer context)</span>
              </label>
              <textarea value={form.creatorBio} onChange={e => setForm(f => ({ ...f, creatorBio: e.target.value }))}
                rows={2} placeholder='e.g. "Team GB marathon runner, top 10 at London 2024. Niche audience of UK endurance athletes."'
                maxLength={400}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
              <p className="mt-1 text-[11px] text-im8-burgundy/40">{form.creatorBio.length}/400</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Rationale <span className="text-im8-burgundy/40 font-normal">(shown to managers — why we approved this deal)</span></label>
              <textarea value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))}
                rows={3} placeholder="Why this influencer? Niche fit, audience quality, past performance..."
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={saveOverview} disabled={saving}
                className={`px-5 py-2 text-white text-sm rounded-lg disabled:opacity-50 transition-colors ${saved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-im8-burgundy hover:bg-im8-red"}`}>
                {saving ? "Saving..." : saved ? "Saved ✓" : "Save influencer details"}
              </button>
            </div>
          </div>

          {/* ── Management feedback (only shown if any per-creator decisions
              or comments came back from the public review site) ── */}
          {managementFeedback.length > 0 && (
            <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-4">
              <div>
                <h3 className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.1em]">Management Feedback</h3>
                <p className="text-xs text-im8-burgundy/40 mt-1">Per-creator decisions and notes left by approvers via the review link.</p>
              </div>
              <div className="space-y-3">
                {managementFeedback.map(f => {
                  // Body is stored as e.g. "[Creator Name] Approved: looks great"
                  // Strip the [Name] prefix for the deal-page display since
                  // the deal page is already scoped to this creator.
                  const cleanedBody = f.body.replace(/^\[[^\]]+\]\s*/, "");
                  const decisionMatch = cleanedBody.match(/^(Approved|Rejected)(?::\s*([\s\S]*))?$/);
                  const decision = decisionMatch?.[1] ?? null;
                  const note = decisionMatch?.[2]?.trim() ?? cleanedBody;
                  const decisionStyle = decision === "Approved"
                    ? "bg-green-100 text-green-700"
                    : decision === "Rejected"
                    ? "bg-red-100 text-red-700"
                    : "bg-im8-burgundy/10 text-im8-burgundy";
                  return (
                    <div key={f.id} className="border border-im8-stone/30 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-im8-burgundy">{f.author_display_name || "Manager"}</span>
                          {decision && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-[6px] font-semibold ${decisionStyle}`}>
                              {decision}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-im8-burgundy/40">
                          {new Date(f.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {note && note !== decision && (
                        <p className="text-sm text-im8-burgundy/80 whitespace-pre-wrap leading-relaxed">{note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Card 2: Deal Terms ── */}
          <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-5">
            <div>
              <h3 className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.1em]">Deal Terms</h3>
              <p className="text-xs text-im8-burgundy/40 mt-1">Rate, duration and deliverables. Saving auto-generates brief rows in the Briefs tab.</p>
            </div>

            <EditableContractSection
              dealId={deal.id as string}
              contractSequence={deal.contract_sequence as number | null}
              initialRate={deal.monthly_rate_cents ? String(Number(deal.monthly_rate_cents) / 100) : ""}
              initialMonths={String(deal.total_months ?? 3)}
              initialIsGifted={Boolean(deal.is_gifted)}
              initialCurrencyCode={(deal.currency_code as string) ?? "USD"}
              initialDeliverables={(deal.deliverables as Array<{ code: string; count: number }>) ?? []}
              canViewRates={canViewRates}
            />

            <div className="border-t border-im8-stone/20 pt-5 grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Discount code</label>
                <input type="text" value={form.discountCode} placeholder="DAVID10"
                  onChange={e => setForm(f => ({ ...f, discountCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 font-mono" />
                <p className="text-xs text-im8-burgundy/40 mt-0.5">Shown to the creator in their portal.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Referral link</label>
                <input type="url" value={form.affiliateLink} placeholder="https://im8health.com/discount/DAVID10"
                  onChange={e => setForm(f => ({ ...f, affiliateLink: e.target.value }))}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                {form.affiliateLink && (
                  <a href={form.affiliateLink} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-im8-red hover:underline mt-0.5 inline-block">Test link ↗</a>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={saveOverview} disabled={saving}
                className={`px-5 py-2 text-white text-sm rounded-lg disabled:opacity-50 transition-colors ${saved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-im8-burgundy hover:bg-im8-red"}`}>
                {saving ? "Saving..." : saved ? "Saved ✓" : "Save deal details"}
              </button>
            </div>
          </div>

          {/* ── Card 3: Creator Portal ── */}
          <div className="bg-white rounded-xl border border-im8-stone/30 p-6">
            <h3 className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-4">Creator Portal</h3>
            <LinkProfileSection dealId={deal.id as string} currentProfileId={deal.influencer_profile_id as string | null} driveFolderId={deal.drive_folder_id as string | null} />
          </div>

          {/* Version history */}
          <VersionHistorySection dealId={deal.id as string} />
        </div>
      )}

      {/* Contract tab */}
      {tab === "contract" && (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-im8-burgundy mb-1">Contract details</h3>
            <p className="text-xs text-im8-burgundy/50">Fill these in once the contract is signed.</p>
          </div>

          {/* Agreed terms summary — sourced from the approved deal */}
          {(() => {
            const agreedMonths = deal.total_months as number | null;
            const agreedRateCents = deal.monthly_rate_cents as number | null;
            const agreedTotalCents = deal.total_rate_cents as number | null;
            const currency = (deal.currency_code as string) || "USD";
            // Always show duration; only show financial figures to management
            const showFinancials = canViewRates && (agreedRateCents != null || agreedTotalCents != null);
            if (!agreedMonths && !showFinancials) return null;
            return (
              <div className="bg-im8-offwhite border border-im8-stone/30 rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-[11px] font-bold text-im8-muted uppercase tracking-[0.08em]">Agreed terms</span>
                {agreedMonths ? <span className="font-semibold text-im8-burgundy">{agreedMonths} months</span> : null}
                {canViewRates && agreedRateCents ? (
                  <span className="text-im8-burgundy/70">
                    {currencySymbol(currency)}{(agreedRateCents / 100).toLocaleString()}/mo
                  </span>
                ) : null}
                {canViewRates && agreedTotalCents ? (
                  <span className="text-im8-burgundy font-medium">
                    = {currencySymbol(currency)}{(agreedTotalCents / 100).toLocaleString()} total
                  </span>
                ) : null}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Campaign start</label>
              <input type="date" value={contract.campaignStart}
                onChange={e => {
                  const start = e.target.value;
                  const months = deal.total_months as number | null;
                  let end = contract.campaignEnd;
                  // Auto-compute end date from agreed duration when a start date is picked
                  if (start && months) {
                    const d = new Date(start);
                    d.setMonth(d.getMonth() + months);
                    end = d.toISOString().split("T")[0];
                  }
                  setContract(c => ({ ...c, campaignStart: start, campaignEnd: end }));
                }}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">
                Campaign end
                {(deal.total_months as number | null) && contract.campaignStart ? (
                  <span className="ml-2 text-[11px] font-normal text-im8-burgundy/40">
                    auto-set · {deal.total_months as number}-month deal
                  </span>
                ) : null}
              </label>
              <input type="date" value={contract.campaignEnd}
                onChange={e => setContract(c => ({ ...c, campaignEnd: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Usage rights (months)</label>
              <input type="number" value={contract.usageRightsMonths}
                onChange={e => setContract(c => ({ ...c, usageRightsMonths: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Payment terms</label>
              <select value={contract.paymentTerms}
                onChange={e => setContract(c => ({ ...c, paymentTerms: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 bg-white">
                <option value="">— Select —</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 7">Net 7</option>
                <option value="50% Advanced, 50% After">50% Advanced, 50% After</option>
                <option value="Full Payment Upfront">Full Payment Upfront</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Contract document URL</label>
            <input type="url" value={contract.contractUrl} placeholder="https://drive.google.com/..."
              onChange={e => setContract(c => ({ ...c, contractUrl: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            {contract.contractUrl && (
              <a href={contract.contractUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-im8-red hover:underline mt-1 inline-block">Open contract ↗</a>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Specific requirements</label>
            <textarea value={contract.contractRequirements} rows={4}
              placeholder="Disclosure requirements, posting schedule, approval windows, revision rounds, brand mentions, anything specific to this contract..."
              onChange={e => setContract(c => ({ ...c, contractRequirements: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
          </div>

          <div className="flex justify-end pt-1">
            <button onClick={saveContract} disabled={savingContract}
              className={`px-5 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 ${savedContract ? "bg-green-600" : "bg-im8-red hover:bg-im8-burgundy"}`}>
              {savingContract ? "Saving..." : savedContract ? "Saved ✓" : "Save contract"}
            </button>
          </div>
        </div>
      )}

      {/* Briefs tab */}
      {tab === "briefs" && (
        <div className="space-y-4">

          {/* Deliverable progress bar */}
          {totalDeliverables > 0 && (
            <div className="bg-white rounded-xl border border-im8-stone/30 px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-im8-burgundy">
                  {completedDeliverables} / {totalDeliverables} deliverables complete
                </p>
                <span className="text-xs text-im8-burgundy/50">
                  {Math.round((completedDeliverables / totalDeliverables) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-im8-stone/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((completedDeliverables / totalDeliverables) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Per-deliverable brief URLs — driven by the deal's deliverables JSON so rows
              appear as soon as deliverables are set in the Overview tab, even before
              tracker rows are fully created. Tracker rows are cross-referenced for the
              saved brief_doc_url and the ID used by Save/Send actions. */}
          {(() => {
            const dealDeliverables = ((deal.deliverables as Array<{ code: string; count: number }> | null) ?? [])
              .filter(d => d && d.code && d.count > 0 && !BINARY_DELIVERABLE_CODES.has(d.code));

            // Build a lookup: "IGR_1" → tracker row (if it exists)
            const trackerByKey = new Map<string, DeliverableRow>();
            for (const d of deliverables) {
              const key = `${d.deliverable_type}_${d.sequence ?? 1}`;
              trackerByKey.set(key, d);
            }

            // Expand deal.deliverables into individual instances (IGR×3 → IGR#1, IGR#2, IGR#3)
            const rows = dealDeliverables.flatMap(item =>
              Array.from({ length: item.count }, (_, i) => {
                const seq = i + 1;
                const key = `${item.code}_${seq}`;
                return {
                  code: item.code,
                  sequence: seq,
                  trackerRow: trackerByKey.get(key) ?? null,
                };
              })
            );

            return (
              <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-im8-burgundy">Per-deliverable briefs</h3>
                  <p className="text-xs text-im8-burgundy/50">
                    Paste a Google Doc link for each deliverable. The creator sees it when they upload content for that row.
                  </p>
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-im8-burgundy/40 py-3 text-center">
                    No deliverables set yet.{" "}
                    <button onClick={() => setTab("overview")} className="text-im8-red hover:underline">
                      Add deliverables in the Overview tab
                    </button>
                    {" "}and save — rows will appear here automatically.
                  </p>
                ) : (
                  <div className="divide-y divide-im8-stone/20 -mx-5">
                    {rows.map(({ code, sequence, trackerRow }) => (
                      <DeliverableBriefRow
                        key={`${code}_${sequence}`}
                        dealId={deal.id as string}
                        deliverableType={code}
                        sequence={sequence}
                        trackerRow={trackerRow}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Gifting tab */}
      {tab === "gifting" && (
        <GiftingTab
          dealId={deal.id as string}
          initialRequests={giftingRequests}
          partnerShippingAddress={partnerShippingAddress}
          initialProductSent={{
            product: (deal.gifted_product as string) ?? "",
            quantity: String(deal.gifted_quantity ?? 1),
            sentAt: (deal.product_sent_at as string) ?? "",
          }}
        />
      )}

      {/* Submissions tab */}
      {tab === "edited-videos" && (
        <AdminEditedVideosTab dealId={deal.id as string} />
      )}

      {tab === "submissions" && (
        <div className="space-y-3">
          {/* Progress overview */}
          {totalDeliverables > 0 && (
            <div className="bg-white rounded-xl border border-im8-stone/30 px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-im8-burgundy">
                  {completedDeliverables} / {totalDeliverables} deliverables complete
                </p>
                <span className="text-xs text-im8-burgundy/50">
                  {Math.round((completedDeliverables / totalDeliverables) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-im8-stone/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((completedDeliverables / totalDeliverables) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {submissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
              No submissions yet.
            </div>
          ) : (
            submissions.map((s, _idx) => {
              // Draft number: count how many submissions for the same deliverable came before this one
              const delivId = s.deliverable_id as string | null;
              const draftNum = delivId
                ? submissions.filter(
                    other =>
                      (other.deliverable_id as string | null) === delivId &&
                      new Date(other.submitted_at as string) <= new Date(s.submitted_at as string),
                  ).length
                : null;

              const statusColors: Record<string, string> = {
                pending: "bg-yellow-100 text-yellow-700",
                approved: "bg-green-100 text-green-700",
                rejected: "bg-red-100 text-red-700",
                revision_requested: "bg-amber-100 text-amber-700",
              };

              return (
                <div key={s.id as string} className="bg-white rounded-xl border border-im8-stone/30 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-im8-burgundy text-sm truncate">{s.file_name as string}</span>
                        {draftNum !== null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-[6px] bg-im8-burgundy/10 text-im8-burgundy font-semibold shrink-0">
                            Draft {draftNum}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-[6px] font-semibold shrink-0 ${statusColors[s.status as string] ?? "bg-gray-100 text-gray-600"}`}>
                          {(s.status as string).replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-im8-burgundy/50 mt-1 capitalize">
                        {s.content_type as string} · Submitted {new Date(s.submitted_at as string).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {s.reviewed_at ? ` · Reviewed ${new Date(s.reviewed_at as string).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : null}
                      </div>
                      {Boolean(s.feedback) && (
                        <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg">{s.feedback as string}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.drive_url ? (
                        <a href={s.drive_url as string} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-im8-burgundy/50 hover:text-im8-red hover:underline">
                          View file ↗
                        </a>
                      ) : null}
                      <Link href="/admin/review" className="text-sm text-im8-red hover:underline">Review →</Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const EV_ADMIN_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  revision_requested: "bg-orange-100 text-orange-700",
};

function AdminEditedVideosTab({ dealId }: { dealId: string }) {
  const [videos, setVideos] = useState<{
    id: string; canonical_file_name: string; original_file_name: string;
    drive_url: string; admin_status: string; influencer_status: string; created_at: string;
    uploaded_by_name?: string;
  }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, { id: string; author_display_name: string; body: string; created_at: string }[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const router = useRouter();

  async function load() {
    const res = await fetch(`/api/edited-videos?dealId=${dealId}`);
    if (res.ok) { const { videos: v } = await res.json(); setVideos(v); }
    setLoaded(true);
  }

  async function loadComments(videoId: string) {
    if (comments[videoId]) return;
    const res = await fetch(`/api/edited-videos/${videoId}/comments`);
    const { comments: c } = await res.json();
    setComments(prev => ({ ...prev, [videoId]: c }));
  }

  async function postComment(videoId: string) {
    const body = newComment[videoId]?.trim();
    if (!body) return;
    const res = await fetch(`/api/edited-videos/${videoId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setComments(prev => ({ ...prev, [videoId]: [...(prev[videoId] ?? []), comment] }));
      setNewComment(prev => ({ ...prev, [videoId]: "" }));
    }
  }

  async function setAdminStatus(videoId: string, status: string) {
    await fetch(`/api/edited-videos/${videoId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_status: status }),
    });
    setVideos(prev => prev.map(v => v.id === videoId ? { ...v, admin_status: status } : v));
    router.refresh();
  }

  if (!loaded) load();

  return (
    <div className="space-y-4">
      {videos.length === 0 && loaded && (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No edited videos yet. Assign an editor to this deal to get started.
        </div>
      )}
      {videos.map(v => (
        <div key={v.id} className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-im8-burgundy truncate">{v.canonical_file_name}</div>
              <div className="text-xs text-im8-burgundy/40 mt-0.5">Original: {v.original_file_name}</div>
              <div className="text-xs text-im8-burgundy/40">
                {new Date(v.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EV_ADMIN_STATUS_COLORS[v.admin_status] ?? "bg-gray-100 text-gray-600"}`}>
                {v.admin_status.replace("_", " ")}
              </span>
              {v.influencer_status !== "pending" && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.influencer_status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  Creator: {v.influencer_status}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {v.drive_url && (
              <a href={v.drive_url} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 bg-im8-sand text-im8-burgundy text-xs rounded-lg hover:bg-im8-stone transition-colors">
                Watch ↗
              </a>
            )}
            {["approved", "rejected", "revision_requested"].map(s => (
              <button key={s} onClick={() => setAdminStatus(v.id, s)}
                disabled={v.admin_status === s}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-40 ${
                  s === "approved" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                  s === "rejected" ? "bg-red-100 text-red-700 hover:bg-red-200" :
                  "bg-orange-100 text-orange-700 hover:bg-orange-200"
                }`}>
                {s === "revision_requested" ? "Request revisions" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button onClick={() => {
              setOpenThreadId(openThreadId === v.id ? null : v.id);
              loadComments(v.id);
            }} className="ml-auto text-xs text-im8-burgundy/50 hover:text-im8-burgundy">
              {openThreadId === v.id ? "Hide thread" : `Thread${(comments[v.id]?.length ?? 0) > 0 ? ` (${comments[v.id].length})` : ""}`}
            </button>
          </div>

          {openThreadId === v.id && (
            <div className="border-t border-im8-stone/20 pt-3 space-y-3">
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(comments[v.id] ?? []).length === 0 && <p className="text-xs text-im8-burgundy/30">No comments yet.</p>}
                {(comments[v.id] ?? []).map(c => (
                  <div key={c.id} className="text-xs space-y-0.5">
                    <div className="flex gap-2"><span className="font-medium text-im8-burgundy">{c.author_display_name}</span>
                      <span className="text-im8-burgundy/30">{new Date(c.created_at).toLocaleDateString()}</span></div>
                    <p className="text-im8-burgundy/70 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newComment[v.id] ?? ""} onChange={e => setNewComment(prev => ({ ...prev, [v.id]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && postComment(v.id)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-1.5 text-xs border border-im8-stone/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                <button onClick={() => postComment(v.id)} disabled={!newComment[v.id]?.trim()}
                  className="px-3 py-1.5 bg-im8-red text-white text-xs rounded-lg hover:bg-im8-burgundy disabled:opacity-50">Post</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const IM8_PRODUCTS = [
  { name: "Daily Ultimate Essentials", sku: "DUE-1" },
  { name: "Daily Ultimate Longevity", sku: "DUL-1" },
  { name: "Beckham Stack", sku: "BKS-1" },
];

function GiftingTab({
  dealId,
  initialRequests,
  partnerShippingAddress,
  initialProductSent,
}: {
  dealId: string;
  initialRequests: GiftingRequest[];
  partnerShippingAddress: ShippingAddress | null;
  initialProductSent: { product: string; quantity: string; sentAt: string };
}) {
  const router = useRouter();
  const [primaryAddress, setPrimaryAddress] = useState<SavedAddress | null>(null);
  const [requests, setRequests] = useState(initialRequests);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});

  // Quick-log state for recording a product that was already sent outside the
  // im8hub flow (e.g. hand-delivered). Replaces the old Overview tab block.
  const [productSent, setProductSent] = useState(initialProductSent);
  const [savingProductSent, setSavingProductSent] = useState(false);
  const [savedProductSent, setSavedProductSent] = useState(false);

  async function saveProductSent() {
    setSavingProductSent(true);
    await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gifted_product: productSent.product || null,
        gifted_quantity: parseInt(productSent.quantity) || 1,
        product_sent_at: productSent.sentAt || null,
      }),
    });
    setSavingProductSent(false);
    setSavedProductSent(true);
    setTimeout(() => setSavedProductSent(false), 2000);
    router.refresh();
  }

  const [form, setForm] = useState({
    recipient_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "Singapore",
    notes: "",
  });

  function toggleProduct(name: string) {
    setSelectedProducts(prev => {
      if (prev[name]) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return { ...prev, [name]: 1 };
    });
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    const products = Object.entries(selectedProducts).map(([name, qty]) => ({ name, qty }));
    if (products.length === 0) { setSendError("Select at least one product."); return; }
    setSending(true);
    setSendError("");
    const res = await fetch(`/api/deals/${dealId}/gifting-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, products }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { setSendError(data.error || "Failed to submit request."); return; }
    setShowForm(false);
    setSelectedProducts({});
    router.refresh();
    // Optimistically refresh the list
    const listRes = await fetch(`/api/deals/${dealId}/gifting-request`);
    if (listRes.ok) {
      const { requests: fresh } = await listRes.json();
      setRequests(fresh);
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    submitted: "bg-blue-100 text-blue-700",
    processing: "bg-orange-100 text-orange-700",
    shipped: "bg-green-100 text-green-700",
    delivered: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-5">
      {/* 1. Shipping addresses — managed list */}
      <ShippingAddressManager dealId={dealId} onPrimaryChange={setPrimaryAddress} />

      {/* 2. Product sent — quick log (replaces the old Overview "Product sent" block) */}
      <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-im8-burgundy">Product sent (quick log)</h3>
            <p className="text-xs text-im8-burgundy/50 mt-0.5">Record product + quantity + date if you shipped outside the im8hub flow.</p>
          </div>
          <button
            type="button" onClick={saveProductSent} disabled={savingProductSent}
            className={`px-4 py-1.5 text-sm rounded-lg text-white transition-colors disabled:opacity-50 ${savedProductSent ? "bg-green-600 hover:bg-green-700" : "bg-im8-burgundy hover:bg-im8-red"}`}
          >
            {savingProductSent ? "Saving…" : savedProductSent ? "Saved ✓" : "Save"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="block text-xs font-medium text-im8-burgundy/60 mb-1">Product</label>
            <select value={productSent.product}
              onChange={e => setProductSent(p => ({ ...p, product: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none">
              <option value="">Select…</option>
              {IM8_PRODUCTS.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-im8-burgundy/60 mb-1">Quantity</label>
            <input type="number" min="1" value={productSent.quantity}
              onChange={e => setProductSent(p => ({ ...p, quantity: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-im8-burgundy/60 mb-1">Date sent</label>
            <input type="date" value={productSent.sentAt}
              onChange={e => setProductSent(p => ({ ...p, sentAt: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
          </div>
        </div>
      </div>

      {/* 3. Existing gifting requests */}
      {requests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">im8hub requests</h3>
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-im8-burgundy">{r.recipient_name}</div>
                  <div className="text-xs text-im8-burgundy/50 mt-0.5">
                    {r.address_line1}{r.address_line2 ? `, ${r.address_line2}` : ""}, {r.city}, {r.postal_code}, {r.country}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[r.im8hub_status ?? "pending"] ?? "bg-gray-100 text-gray-600"}`}>
                  {r.im8hub_status ?? "Pending"}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {r.products.map((p, i) => (
                  <span key={i} className="text-xs bg-im8-sand text-im8-burgundy px-2 py-0.5 rounded-full">
                    {p.name} ×{p.qty}
                  </span>
                ))}
              </div>
              {r.tracking_url && (
                <a href={r.tracking_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-im8-red hover:underline">
                  Track shipment ↗ {r.tracking_number && `(${r.tracking_number})`}
                </a>
              )}
              {r.notes && <p className="text-xs text-im8-burgundy/50 italic">{r.notes}</p>}
              <div className="text-xs text-im8-burgundy/30">
                Requested {new Date(r.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => {
            // Auto-fill form from primary address when opening
            if (primaryAddress) {
              setForm({
                recipient_name: primaryAddress.recipient_name,
                phone: primaryAddress.phone ?? "",
                address_line1: primaryAddress.address_line1,
                address_line2: primaryAddress.address_line2 ?? "",
                city: primaryAddress.city,
                state: primaryAddress.state ?? "",
                postal_code: primaryAddress.postal_code,
                country: primaryAddress.country,
                notes: "",
              });
            }
            setShowForm(true);
          }}
          className="w-full py-3 border-2 border-dashed border-im8-stone/40 rounded-xl text-sm font-medium text-im8-burgundy/60 hover:border-im8-red/40 hover:text-im8-red transition-colors">
          + New gifting request
        </button>
      )}

      {showForm && (
        <form onSubmit={submitRequest} className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-im8-burgundy">New gifting request</h3>
            <p className="text-xs text-im8-burgundy/50 mt-0.5">
              {primaryAddress
                ? "Pre-filled from primary address — edit as needed."
                : "No primary address saved — fill in manually or add one above."}
            </p>
          </div>

          {/* Products */}
          <div>
            <label className="block text-sm font-semibold text-im8-burgundy mb-2">Products to send *</label>
            <div className="space-y-2">
              {IM8_PRODUCTS.map(p => (
                <label key={p.name} className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={!!selectedProducts[p.name]}
                    onChange={() => toggleProduct(p.name)}
                    className="w-4 h-4 accent-im8-red" />
                  <span className="text-sm text-im8-burgundy group-hover:text-im8-red">{p.name}</span>
                  {selectedProducts[p.name] !== undefined && (
                    <div className="flex items-center gap-1 ml-auto">
                      <button type="button" onClick={() => setSelectedProducts(prev => ({ ...prev, [p.name]: Math.max(1, (prev[p.name] ?? 1) - 1) }))}
                        className="w-5 h-5 rounded border text-xs hover:bg-im8-sand">−</button>
                      <span className="text-xs w-5 text-center">{selectedProducts[p.name]}</span>
                      <button type="button" onClick={() => setSelectedProducts(prev => ({ ...prev, [p.name]: (prev[p.name] ?? 1) + 1 }))}
                        className="w-5 h-5 rounded border text-xs hover:bg-im8-sand">+</button>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          <hr className="border-im8-stone/20" />

          {/* Shipping address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Recipient name *</label>
              <input required value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+65 9123 4567"
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Address line 1 *</label>
              <input required value={form.address_line1} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Address line 2</label>
              <input value={form.address_line2} onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">City *</label>
              <input required value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">State / Province</label>
              <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Postal code *</label>
              <input required value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Country *</label>
              <select required value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40">
                {["Singapore", "Australia", "United Kingdom", "United States", "Canada", "Hong Kong", "New Zealand", "Malaysia", "Other"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Notes for ops</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                placeholder="e.g. Leave with concierge, fragile, priority shipping..."
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
            </div>
          </div>

          {sendError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{sendError}</div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-im8-burgundy/50 hover:text-im8-burgundy">
              Cancel
            </button>
            <button type="submit" disabled={sending}
              className="px-5 py-2 bg-im8-red text-white text-sm font-medium rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
              {sending ? "Sending to im8hub..." : "Submit gifting request →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-im8-burgundy mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
    </div>
  );
}

// Re-export the canonical registry so existing importers of this file
// (`import { DELIVERABLE_LABELS, BINARY_DELIVERABLE_CODES } from .../deal-detail-client`)
// keep working without churn.
export { DELIVERABLE_LABELS, BINARY_DELIVERABLE_CODES };

// Codes that are rights/extras — excluded from the content brief deliverable list.
// Denis (support) writes the brief for the actual content deliverables only.
// Mirrors BINARY_DELIVERABLE_CODES today; kept as a separate export so future
// per-context divergence stays cheap to introduce.
export const BRIEF_EXCLUDED_CODES = BINARY_DELIVERABLE_CODES;

// Format a single deliverable for display.
export function formatDeliverable(item: { code: string; count: number }): string | null {
  if (!item || !item.code) return null;
  if (BINARY_DELIVERABLE_CODES.has(item.code)) {
    return item.count > 0 ? DELIVERABLE_LABELS[item.code] ?? item.code : null;
  }
  if (item.count <= 0) return null;
  return `${item.count}× ${DELIVERABLE_LABELS[item.code] ?? item.code}`;
}

export function formatDeliverables(items: Array<{ code: string; count: number }>): string {
  const parts = items.map(formatDeliverable).filter((s): s is string => !!s);
  return parts.length ? parts.join(", ") : "No deliverables set";
}

// Editable contract accordion — rate, months, gifted toggle, deliverables picker + save.
function EditableContractSection({
  dealId, contractSequence, initialRate, initialMonths, initialIsGifted,
  initialCurrencyCode, initialDeliverables, canViewRates,
}: {
  dealId: string;
  contractSequence: number | null;
  initialRate: string;
  initialMonths: string;
  initialIsGifted: boolean;
  initialCurrencyCode: string;
  initialDeliverables: Array<{ code: string; count: number }>;
  canViewRates: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(initialRate);
  const [months, setMonths] = useState(initialMonths);
  const [isGifted, setIsGifted] = useState(initialIsGifted);
  const [currencyCode, setCurrencyCode] = useState(initialCurrencyCode);
  const [deliverableCounts, setDeliverableCounts] = useState<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const d of initialDeliverables) {
      if (d && d.code && d.count > 0) counts[d.code] = d.count;
    }
    return counts;
  });
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [briefNote, setBriefNote] = useState("");

  const seq = contractSequence ?? 1;
  const rateNum = parseFloat(rate) || 0;
  const monthsNum = parseInt(months) || 3;
  const activeDeliverables = Object.entries(deliverableCounts)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => ({ code, count }));

  const rateText = isGifted
    ? "Gifted"
    : rateNum && canViewRates
      ? `${currencySymbol(currencyCode)}${rateNum.toLocaleString()}/mo × ${monthsNum}mo`
      : `${monthsNum} months`;

  const deliverablesSummary = formatDeliverables(activeDeliverables);

  function setCount(code: string, count: number) {
    setDeliverableCounts(prev => {
      if (count <= 0) {
        const next = { ...prev };
        delete next[code];
        return next;
      }
      return { ...prev, [code]: count };
    });
  }

  async function save() {
    setSaving(true);
    setBriefNote("");
    await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthly_rate_cents: isGifted ? null : (rateNum ? Math.round(rateNum * 100) : null),
        total_months: monthsNum,
        is_gifted: isGifted,
        currency_code: currencyCode,
        deliverables: activeDeliverables,
      }),
    });

    // Auto-create a content brief if deliverables are set and no brief exists yet.
    // Denis (support) will then add the Google Doc link and send it to the creator.
    const contentDeliverables = activeDeliverables.filter(d => !BRIEF_EXCLUDED_CODES.has(d.code));
    if (contentDeliverables.length > 0) {
      try {
        const briefRes = await fetch("/api/briefs/auto-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId, deliverables: contentDeliverables }),
        });
        if (briefRes.ok) {
          const { created } = await briefRes.json();
          if (created) setBriefNote("📋 Brief created — click the Briefs tab to open it and add the Google Doc link.");
        }
      } catch {
        // Auto-create failed silently — Denis can create it manually from the Briefs tab.
      }
    }

    // Refresh server-side data so the Briefs tab shows the newly created brief.
    router.refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setBriefNote(""); }, 8000);
  }

  return (
    <div className="border border-im8-stone/30 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-im8-sand/40 hover:bg-im8-sand/70 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-im8-burgundy font-medium">{rateText}</span>
          <span className="text-xs text-im8-burgundy/60">· {deliverablesSummary}</span>
        </div>
        <span className="text-im8-burgundy/40 text-xs shrink-0">{open ? "Hide ▲" : "Edit ▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-4 bg-white space-y-4 border-t border-im8-stone/20">
          {/* Rate + duration */}
          {canViewRates ? (
            <div className="grid grid-cols-[auto_1fr_1fr] gap-3">
              <div>
                <label className="block text-xs font-medium text-im8-burgundy/70 mb-1">Currency</label>
                <select value={currencyCode}
                  onChange={e => setCurrencyCode(e.target.value)}
                  disabled={isGifted}
                  className={`w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/40 ${isGifted ? "bg-im8-sand/40 text-im8-burgundy/40" : "text-im8-burgundy"}`}>
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-im8-burgundy/70 mb-1">Monthly rate</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-im8-burgundy/50">{currencySymbol(currencyCode)}</span>
                  <input
                    type="number" value={rate}
                    onChange={e => setRate(e.target.value)}
                    disabled={isGifted}
                    placeholder={isGifted ? "N/A (gifted)" : "e.g. 3000"}
                    className={`w-full pl-8 pr-3 py-2 border border-im8-stone/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-im8-red/40 ${isGifted ? "bg-im8-sand/40 text-im8-burgundy/40" : "text-im8-burgundy"}`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-im8-burgundy/70 mb-1">Duration (months)</label>
                <input
                  type="number" min="1" max="24" value={months}
                  onChange={e => setMonths(e.target.value)}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-im8-burgundy/70 mb-1">Duration (months)</label>
              <input
                type="number" min="1" max="24" value={months}
                onChange={e => setMonths(e.target.value)}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
              />
            </div>
          )}

          {/* Total summary (canViewRates + not gifted) */}
          {canViewRates && !isGifted && rateNum > 0 && (
            <p className="text-xs text-im8-burgundy/50 -mt-1">
              {currencySymbol(currencyCode)}{(rateNum * monthsNum).toLocaleString()} total over {monthsNum} month{monthsNum === 1 ? "" : "s"}
            </p>
          )}

          {/* Gifted toggle */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-im8-sand/50 rounded-lg border border-im8-stone/20">
            <Toggle on={isGifted} onChange={setIsGifted} label="Gifted Collaboration" />
            {isGifted && (
              <span className="text-xs text-im8-burgundy/60">No monthly payment — product only. Manage shipping on the Gifting tab.</span>
            )}
          </div>

          {/* Deliverables picker */}
          <div>
            <div className="text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide mb-2">Deliverables</div>

            {/* Countable deliverables — only render those that are actually
                selected. Unselected codes are accessible via the + Add picker
                below, keeping the UI focused on what's actually in the deal. */}
            <div className="space-y-2 mb-3">
              {(() => {
                const countableEntries = Object.entries(DELIVERABLE_LABELS)
                  .filter(([code]) => !BINARY_DELIVERABLE_CODES.has(code));
                const selected = countableEntries.filter(([code]) => (deliverableCounts[code] ?? 0) > 0);
                const available = countableEntries.filter(([code]) => (deliverableCounts[code] ?? 0) === 0);

                return (
                  <>
                    {selected.length === 0 ? (
                      <p className="text-xs text-im8-burgundy/40 italic py-2">
                        No deliverables yet. Use <strong>+ Add deliverable</strong> to add one.
                      </p>
                    ) : (
                      selected.map(([code, label]) => {
                        const count = deliverableCounts[code] ?? 0;
                        return (
                          <div key={code} className="flex items-center gap-3 px-3 py-2 bg-im8-sand/30 border border-im8-stone/15 rounded-lg">
                            <span className="text-sm text-im8-burgundy font-medium flex-1">{label}</span>
                            <div className="flex items-center gap-1.5">
                              <button type="button"
                                onClick={() => setCount(code, Math.max(0, count - 1))}
                                className="w-7 h-7 rounded border border-im8-stone/40 hover:bg-white text-im8-burgundy text-sm font-medium transition-colors">
                                −
                              </button>
                              <span className="w-8 text-center text-sm font-semibold tabular-nums text-im8-burgundy">
                                {count}
                              </span>
                              <button type="button"
                                onClick={() => setCount(code, count + 1)}
                                className="w-7 h-7 rounded border border-im8-stone/40 hover:bg-white text-im8-burgundy text-sm font-medium transition-colors">
                                +
                              </button>
                              <button type="button"
                                onClick={() => setCount(code, 0)}
                                aria-label={`Remove ${label}`}
                                title="Remove"
                                className="ml-1 w-7 h-7 rounded text-im8-burgundy/40 hover:text-red-600 hover:bg-red-50 text-base leading-none transition-colors">
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Add picker — only show when there are unselected codes. Selecting
                        an option immediately adds it at count=1; the select then resets. */}
                    {available.length > 0 && (
                      <div className="pt-1">
                        <select
                          value=""
                          onChange={e => {
                            const code = e.target.value;
                            if (code) setCount(code, 1);
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-im8-stone/50 bg-white text-im8-burgundy hover:border-im8-red/60 hover:text-im8-red transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-im8-red/30"
                        >
                          <option value="" disabled>+ Add deliverable…</option>
                          {available.map(([code, label]) => (
                            <option key={code} value={code}>{label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Binary rights / extras */}
            <div className="border-t border-im8-stone/10 pt-3">
              <div className="text-xs text-im8-burgundy/40 uppercase tracking-wide mb-2">Rights &amp; extras</div>
              <div className="space-y-2.5">
                {Object.entries(DELIVERABLE_LABELS)
                  .filter(([code]) => BINARY_DELIVERABLE_CODES.has(code))
                  .map(([code, label]) => {
                    const on = (deliverableCounts[code] ?? 0) > 0;
                    return (
                      <div key={code} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-im8-burgundy">{label}</span>
                        <Toggle on={on} onChange={v => setCount(code, v ? 1 : 0)} label={on ? "Yes" : "No"} />
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-im8-stone/10 gap-3">
            {briefNote && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex-1">{briefNote}</p>}
            <button type="button" onClick={save} disabled={saving}
              className={`px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 shrink-0 ${saved ? "bg-green-600 hover:bg-green-700" : "bg-im8-red hover:bg-im8-burgundy"}`}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save contract terms"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Collapsible version history — lazy-loads audit events on first open.
function VersionHistorySection({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Array<{
    id: string;
    action: string;
    after: Record<string, unknown> | null;
    created_at: string;
    actor: { full_name: string } | null;
  }> | null>(null);

  async function load() {
    if (events !== null) return;
    setLoading(true);
    const res = await fetch(`/api/deals/${dealId}/history`);
    if (res.ok) {
      const { events: e } = await res.json();
      setEvents(e);
    } else {
      setEvents([]);
    }
    setLoading(false);
  }

  function toggle() {
    if (!open) load();
    setOpen(o => !o);
  }

  const FIELD_LABELS: Record<string, string> = {
    influencer_name: "Name", influencer_email: "Email", agency_name: "Agency",
    platform_primary: "Platform", monthly_rate_cents: "Monthly rate", total_months: "Duration",
    is_gifted: "Gifted collaboration", deliverables: "Deliverables", rationale: "Rationale",
    instagram_handle: "Instagram", tiktok_handle: "TikTok", youtube_handle: "YouTube",
    follower_count: "Followers", niche_tags: "Niche tags",
    campaign_start: "Campaign start", campaign_end: "Campaign end",
    contract_url: "Contract URL",
    payment_terms: "Payment terms", contract_requirements: "Requirements",
    usage_rights_months: "Usage rights", needs_approval: "Needs approval",
    discount_code: "Discount code", affiliate_link: "Affiliate link",
  };

  function describe(action: string, after: Record<string, unknown> | null) {
    if (action.startsWith("status_changed_to_")) {
      const s = action.replace("status_changed_to_", "").replace(/_/g, " ");
      return `Status → ${s}`;
    }
    if (!after || Object.keys(after).length === 0) return action.replace(/_/g, " ");
    const fields = Object.keys(after).map(k => FIELD_LABELS[k] ?? k);
    return `Updated: ${fields.join(", ")}`;
  }

  return (
    <div className="border border-im8-stone/20 rounded-xl overflow-hidden">
      <button
        type="button" onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-im8-sand/20 hover:bg-im8-sand/50 transition-colors text-left"
      >
        <span className="text-sm font-medium text-im8-burgundy/70">Version history</span>
        <span className="text-im8-burgundy/40 text-xs shrink-0">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-3 bg-white border-t border-im8-stone/20">
          {loading && (
            <div className="flex items-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-im8-red border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-im8-burgundy/50">Loading…</span>
            </div>
          )}
          {!loading && events && events.length === 0 && (
            <p className="text-sm text-im8-burgundy/40 italic py-2">No edit history recorded yet.</p>
          )}
          {!loading && events && events.length > 0 && (
            <div className="space-y-1 max-h-72 overflow-y-auto -mx-1 px-1">
              {events.map((ev, i) => (
                <div key={ev.id}
                  className={`flex items-start gap-3 py-2 ${i < events.length - 1 ? "border-b border-im8-stone/10" : ""}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-im8-stone/50 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-im8-burgundy">
                      {describe(ev.action, ev.after)}
                    </div>
                    <div className="text-xs text-im8-burgundy/45 mt-0.5">
                      {ev.actor?.full_name ?? "Unknown"} · {new Date(ev.created_at).toLocaleString("en-AU", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusOverrideSelect({ status, dealId, onRefresh }: {
  status: string; dealId: string; onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState("");

  function handleChange(next: string) {
    if (next === status) return;
    setPending(next);
    setConfirm(true);
  }

  async function doOverride() {
    setLoading(true);
    setConfirm(false);
    await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: pending }),
    });
    setLoading(false);
    onRefresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-im8-burgundy/40 uppercase tracking-[0.06em] font-medium">Override</span>
      <select
        value={status}
        disabled={loading}
        onChange={e => handleChange(e.target.value)}
        className="text-xs px-2 py-1.5 border border-im8-stone/40 rounded-lg text-im8-burgundy bg-white focus:outline-none disabled:opacity-50 capitalize"
      >
        {STATUS_FLOW.map(s => (
          <option key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</option>
        ))}
      </select>
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-im8-burgundy mb-2">Change status?</p>
            <p className="text-xs text-im8-burgundy/60 mb-5">
              Move this deal from <span className="font-medium capitalize">{status.replace(/_/g, " ")}</span> → <span className="font-medium capitalize">{pending.replace(/_/g, " ")}</span>. This bypasses the normal flow.
            </p>
            <div className="flex gap-3">
              <button onClick={doOverride}
                className="flex-1 py-2 bg-im8-burgundy text-white text-sm rounded-lg hover:bg-im8-red transition-colors">
                Confirm
              </button>
              <button onClick={() => setConfirm(false)}
                className="flex-1 py-2 border border-im8-stone/40 text-im8-burgundy text-sm rounded-lg hover:bg-im8-offwhite transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageButton({ status, dealId, onRefresh, onMarkAgreed, needsApproval, role = "" }: {
  status: string; dealId: string; onRefresh: () => void; onMarkAgreed: () => void; needsApproval: boolean; role?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function advance(next: string) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update status");
      setLoading(false);
      return;
    }
    onRefresh();
    setLoading(false);
  }

  const btn = (label: string, onClick: () => void, className: string) => (
    <div className="shrink-0 ml-4 flex flex-col items-end gap-1">
      <button onClick={onClick} disabled={loading}
        className={`px-4 py-2 text-white text-sm rounded-lg transition-colors disabled:opacity-60 ${loading ? "cursor-wait" : ""} ${className}`}>
        {loading ? "Updating..." : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );

  if (status === "contacted")
    return btn("Start negotiating →", () => advance("negotiating"), "bg-blue-500 hover:bg-blue-600");
  if (status === "negotiating")
    return btn("Mark agreed →", onMarkAgreed, "bg-yellow-500 hover:bg-yellow-600");
  if (status === "agreed" && needsApproval)
    return (
      <Link href={`/admin/approvals?addDeal=${dealId}`}
        className="shrink-0 ml-4 px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors">
        Send for approval →
      </Link>
    );
  if (status === "agreed" && !needsApproval)
    return btn("Mark approved →", () => advance("approved"), "bg-green-600 hover:bg-green-700");
  if (status === "approved" && role !== "support")
    return btn("Move to contracted →", () => advance("contracted"), "bg-emerald-600 hover:bg-emerald-700");
  if (status === "contracted")
    return btn("Mark live →", () => advance("live"), "bg-emerald-600 hover:bg-emerald-700");
  if (status === "live")
    return btn("Mark completed →", () => advance("completed"), "bg-gray-500 hover:bg-gray-600");
  return null;
}

function InviteButton({ email, dealId, alreadyLinked }: { email: string; dealId: string; alreadyLinked?: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function sendInvite() {
    setStatus("sending");
    setErrorMsg("");
    const res = await fetch(`/api/deals/${dealId}/invite`, {
      method: "POST",
    });
    if (res.ok) {
      setStatus("sent");
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Unknown error");
      setStatus("error");
    }
  }

  // Already linked — show a muted "Portal linked" indicator but keep a
  // "Resend invite" affordance in case the creator lost the link.
  if (alreadyLinked) {
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-xs px-2 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 font-medium">
          ✓ Portal linked
        </span>
        <button type="button" onClick={sendInvite} disabled={status === "sending" || status === "sent"}
          className="text-xs text-im8-burgundy/50 hover:text-im8-red hover:underline">
          {status === "sending" ? "Sending…" : status === "sent" ? "Resent ✓" : "Resend invite"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <button type="button" onClick={sendInvite} disabled={status === "sending" || status === "sent"}
        className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 inline-flex items-center gap-1.5 ${
          status === "sent"
            ? "bg-green-600 text-white"
            : status === "error"
            ? "bg-red-50 text-red-700 border border-red-300"
            : "bg-im8-red text-white hover:bg-im8-burgundy"
        }`}>
        {status === "sending" ? "Sending…" : status === "sent" ? `✓ Invite sent to ${email}` : status === "error" ? "Failed — retry" : "✉ Send portal invite"}
      </button>
      {status === "error" && errorMsg && (
        <p className="text-xs text-red-500 mt-1">{errorMsg}</p>
      )}
    </div>
  );
}

function LinkProfileSection({ dealId, currentProfileId, driveFolderId }: {
  dealId: string;
  currentProfileId: string | null;
  driveFolderId: string | null;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "linking" | "linked" | "error">("idle");
  const [subFolderStatus, setSubFolderStatus] = useState<"idle" | "creating" | "created" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function linkProfile() {
    if (!email) return;
    setStatus("linking");
    setMsg("");
    const res = await fetch(`/api/deals/${dealId}/link-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || "Failed"); setStatus("error"); return; }
    setStatus("linked");
    setMsg("Profile linked. They can now log in and see this deal.");
  }

  async function createSubFolder() {
    setSubFolderStatus("creating");
    const res = await fetch("/api/drive/create-subfolder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || "Failed to create sub-folder"); setSubFolderStatus("error"); return; }
    setSubFolderStatus("created");
    setMsg("Sub-folder created in their Drive.");
  }

  return (
    <div className="space-y-3">
      {currentProfileId ? (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Profile linked — influencer can access this deal in the portal.
        </p>
      ) : (
        <div className="flex gap-2">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Influencer or agency email"
            className="flex-1 px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
          />
          <button onClick={linkProfile} disabled={!email || status === "linking" || status === "linked"}
            className="px-3 py-2 bg-im8-red text-white text-xs rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors whitespace-nowrap">
            {status === "linking" ? "Linking…" : status === "linked" ? "Linked ✓" : "Link profile"}
          </button>
        </div>
      )}

      {/* Drive folder row — visible whether or not the profile is linked */}
      <div className="flex items-center gap-3 flex-wrap">
        {(driveFolderId || subFolderStatus === "created") ? (
          <a
            href={`https://drive.google.com/drive/folders/${driveFolderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-im8-burgundy/70 hover:text-im8-red hover:underline"
          >
            <svg className="w-3.5 h-3.5 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.5 19.5L9 12l4.5 7.5H4.5zM19.5 19.5l-3-7.5H12l3 7.5h4.5zM12 4.5L8.25 12h7.5L12 4.5z"/>
            </svg>
            Open Drive folder ↗
          </a>
        ) : (
          <>
            <span className="text-xs text-im8-burgundy/50">No Drive folder yet</span>
            <button
              onClick={createSubFolder}
              disabled={subFolderStatus === "creating"}
              className="text-xs px-2.5 py-1 border border-im8-stone/40 rounded-lg text-im8-burgundy/60 hover:text-im8-burgundy hover:border-im8-stone/70 disabled:opacity-50 transition-colors"
            >
              {subFolderStatus === "creating" ? "Creating…" : "Create Drive folder"}
            </button>
          </>
        )}
      </div>

      {msg && <p className={`text-xs ${status === "error" || subFolderStatus === "error" ? "text-red-500" : "text-green-700"}`}>{msg}</p>}
    </div>
  );
}

const COUNTRIES = ["Singapore","Australia","United Kingdom","United States","Canada","Hong Kong","New Zealand","Malaysia","Other"];

function ShippingAddressManager({
  dealId, onPrimaryChange,
}: {
  dealId: string;
  onPrimaryChange: (addr: SavedAddress | null) => void;
}) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [newAddr, setNewAddr] = useState({
    label: "Home", recipient_name: "", phone: "",
    address_line1: "", address_line2: "", city: "",
    state: "", postal_code: "", country: "Singapore",
    is_primary: true,
  });

  async function requestFromCreator() {
    setRequestError("");
    setRequesting(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/request-shipping`, { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        setRequestError(error || "Failed to send email");
      } else {
        setRequested(true);
        setTimeout(() => setRequested(false), 5000);
      }
    } catch (err) {
      console.error(err);
      setRequestError("Network error");
    } finally {
      setRequesting(false);
    }
  }

  async function load() {
    const res = await fetch(`/api/shipping-addresses?dealId=${dealId}`);
    if (res.ok) {
      const { addresses: list } = await res.json();
      setAddresses(list ?? []);
      const primary = list?.find((a: SavedAddress) => a.is_primary) ?? list?.[0] ?? null;
      onPrimaryChange(primary);
    }
    setLoaded(true);
  }

  // Load on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [dealId]);

  async function setPrimary(id: string) {
    await fetch(`/api/shipping-addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
    });
    load();
  }

  async function deleteAddr(id: string) {
    setDeletingId(id);
    await fetch(`/api/shipping-addresses/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setConfirmDeleteId(null);
    load();
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/shipping-addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newAddr, deal_id: dealId }),
    });
    setSaving(false);
    setShowForm(false);
    setNewAddr({ label: "Home", recipient_name: "", phone: "", address_line1: "", address_line2: "", city: "", state: "", postal_code: "", country: "Singapore", is_primary: false });
    load();
  }

  const addrInput = (label: string, key: keyof typeof newAddr, opts?: { placeholder?: string; required?: boolean; type?: string }) => (
    <div>
      <label className="block text-xs font-medium text-im8-burgundy/60 mb-1">{label}{opts?.required ? " *" : ""}</label>
      <input
        type={opts?.type ?? "text"}
        required={opts?.required}
        placeholder={opts?.placeholder}
        value={String(newAddr[key])}
        onChange={e => setNewAddr(a => ({ ...a, [key]: e.target.value }))}
        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-im8-burgundy">Shipping addresses</h3>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)}
            className="text-xs text-im8-red hover:underline font-medium">
            + Add address
          </button>
        )}
      </div>

      {loaded && addresses.length === 0 && !showForm && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
          <p className="text-sm text-amber-800">
            No shipping address saved yet. Add one below, or ask the creator to add theirs via their portal.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={requestFromCreator}
              disabled={requesting || requested}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${requested ? "bg-green-600 text-white" : "bg-im8-burgundy text-white hover:bg-im8-red disabled:opacity-50"}`}
            >
              {requesting ? "Sending…" : requested ? "✓ Email sent" : "✉ Email creator to collect address"}
            </button>
            {requestError && (
              <span className="text-xs text-red-600">{requestError}</span>
            )}
          </div>
        </div>
      )}

      {addresses.map(addr => (
        <div key={addr.id}
          className={`rounded-xl border px-4 py-3 ${addr.is_primary ? "border-im8-red/25 bg-im8-red/5" : "border-im8-stone/30 bg-im8-sand/20"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-im8-burgundy">{addr.label}</span>
                {addr.is_primary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-im8-red text-white font-semibold leading-none">Primary</span>
                )}
                {addr.is_legacy && (
                  <span className="text-[10px] text-im8-burgundy/40">from creator portal</span>
                )}
              </div>
              <div className="text-sm text-im8-burgundy font-medium">{addr.recipient_name}</div>
              <div className="text-xs text-im8-burgundy/60 mt-0.5">
                {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}{", "}
                {[addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")}
                {addr.country ? ` · ${addr.country}` : ""}
              </div>
              {addr.phone && <div className="text-xs text-im8-burgundy/40 mt-0.5">{addr.phone}</div>}
            </div>

            {!addr.is_legacy && (
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {!addr.is_primary && (
                  <button type="button" onClick={() => setPrimary(addr.id)}
                    className="text-xs text-im8-burgundy/50 hover:text-im8-red transition-colors">
                    Set primary
                  </button>
                )}
                {confirmDeleteId === addr.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-red-500">Delete?</span>
                    <button type="button" onClick={() => deleteAddr(addr.id)} disabled={deletingId === addr.id}
                      className="text-[10px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
                      {deletingId === addr.id ? "…" : "Yes"}
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] text-im8-burgundy/40 hover:text-im8-burgundy">No</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDeleteId(addr.id)}
                    className="text-xs text-im8-burgundy/25 hover:text-red-500 transition-colors">
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {showForm && (
        <form onSubmit={addAddress} className="border border-im8-stone/30 rounded-xl p-4 space-y-3 bg-im8-sand/10">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-im8-burgundy/60 mb-1">Label</label>
              <select value={newAddr.label} onChange={e => setNewAddr(a => ({ ...a, label: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none">
                {["Home", "Office", "Other"].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            {addrInput("Recipient name", "recipient_name", { required: true })}
            {addrInput("Phone", "phone", { placeholder: "+65 9123 4567" })}
            <div className="col-span-2">{addrInput("Address line 1", "address_line1", { required: true, placeholder: "Street / unit" })}</div>
            <div className="col-span-2">{addrInput("Address line 2", "address_line2", { placeholder: "Floor, building (optional)" })}</div>
            {addrInput("City", "city", { required: true })}
            {addrInput("Postal code", "postal_code", { required: true })}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-im8-burgundy/60 mb-1">Country *</label>
              <select required value={newAddr.country} onChange={e => setNewAddr(a => ({ ...a, country: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none">
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newAddr.is_primary}
              onChange={e => setNewAddr(a => ({ ...a, is_primary: e.target.checked }))}
              className="w-4 h-4 accent-im8-red" />
            <span className="text-sm text-im8-burgundy">Set as primary (auto-fills gifting requests)</span>
          </label>
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-im8-burgundy/50 hover:text-im8-burgundy">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save address"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function DeleteBriefButton({ briefId, onDeleted }: { briefId: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function doDelete() {
    setDeleting(true);
    const res = await fetch(`/api/briefs/${briefId}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else setDeleting(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-500">Delete brief?</span>
        <button onClick={doDelete} disabled={deleting}
          className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
          {deleting ? "…" : "Yes"}
        </button>
        <button onClick={() => setConfirming(false)}
          className="text-xs text-im8-burgundy/40 hover:text-im8-burgundy">Cancel</button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="text-xs text-im8-burgundy/30 hover:text-red-500 transition-colors">
      Delete
    </button>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2.5">
      <span className={`relative w-9 h-5 rounded-full transition-colors ${on ? "bg-im8-red" : "bg-im8-stone/40"}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "left-4" : "left-0.5"}`} />
      </span>
      <span className="text-sm font-medium text-im8-burgundy">{label}</span>
    </button>
  );
}

// Per-deliverable brief-URL editor. Renders one row per deliverable with an
// inline Google Doc URL input. Saves on blur / Enter.
function DeliverableBriefRow({
  dealId,
  deliverableType,
  sequence,
  trackerRow,
}: {
  dealId: string;
  deliverableType: string;
  sequence: number;
  trackerRow: DeliverableRow | null;
}) {
  const [url, setUrl] = useState(trackerRow?.brief_doc_url ?? "");
  const [savedUrl, setSavedUrl] = useState(trackerRow?.brief_doc_url ?? "");
  // rowId is set once we have a tracker row (either passed in or created on first Save)
  const [rowId, setRowId] = useState<string | null>(trackerRow?.id ?? null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Attach content state
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachMode, setAttachMode] = useState<"link" | "file">("link");
  const [attachDriveUrl, setAttachDriveUrl] = useState("");
  const [attachCaption, setAttachCaption] = useState("");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachVariantLabel, setAttachVariantLabel] = useState("");
  const [attachIsScript, setAttachIsScript] = useState(false);
  const [attachStatus, setAttachStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [attachResult, setAttachResult] = useState<{ driveUrl: string | null; canonicalName: string; copied: boolean; uploaded: boolean; isScript?: boolean } | null>(null);
  const [attachError, setAttachError] = useState("");

  async function handleAttach() {
    if (attachStatus === "submitting") return;
    setAttachStatus("submitting");
    setAttachError("");

    // Need a tracker row ID first — create one if missing
    let id = rowId;
    if (!id) {
      const res = await fetch(`/api/deals/${dealId}/deliverable-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: deliverableType, sequence, brief_doc_url: null }),
      });
      if (res.ok) {
        const data = await res.json();
        id = data.id as string;
        setRowId(id);
      }
    }
    if (!id) {
      setAttachError("Could not resolve deliverable — try refreshing.");
      setAttachStatus("error");
      return;
    }

    try {
      let res: Response;
      if (attachMode === "file" && attachFile) {
        const fd = new FormData();
        fd.append("file", attachFile);
        if (attachCaption) fd.append("caption", attachCaption);
        if (attachVariantLabel) fd.append("variantLabel", attachVariantLabel);
        if (attachIsScript) fd.append("isScript", "true");
        res = await fetch(`/api/deliverables/${id}/attach-content`, { method: "POST", body: fd });
      } else {
        if (!attachDriveUrl.includes("drive.google.com") && !attachDriveUrl.startsWith("http")) {
          setAttachError("Please enter a valid Drive or web URL.");
          setAttachStatus("error");
          return;
        }
        res = await fetch(`/api/deliverables/${id}/attach-content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driveUrl: attachDriveUrl,
            caption: attachCaption || undefined,
            variantLabel: attachVariantLabel || undefined,
            isScript: attachIsScript || undefined,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) { setAttachError(data.error || "Failed"); setAttachStatus("error"); return; }
      setAttachResult(data as { driveUrl: string | null; canonicalName: string; copied: boolean; uploaded: boolean; isScript?: boolean });
      setAttachStatus("done");
      // Scripts don't mark the deliverable as done — they're reference docs.
      if (!attachIsScript) setIsDone(true);
    } catch (e) {
      setAttachError(e instanceof Error ? e.message : "Network error");
      setAttachStatus("error");
    }
  }

  function AttachPanel() {
    if (!attachOpen) return null;
    if (attachStatus === "done" && attachResult) {
      const wasScript = !!attachResult.isScript;
      return (
        <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1.5">
          <p className="text-xs font-semibold text-emerald-700">
            {wasScript ? "✓ Script saved to deliverable folder" : "✓ Content attached and marked as completed"}
          </p>
          <p className="text-[11px] text-emerald-600 font-mono">{attachResult.canonicalName}</p>
          {attachResult.copied && <p className="text-[11px] text-emerald-600">Copied to partner&apos;s Drive folder ✓</p>}
          {attachResult.uploaded && <p className="text-[11px] text-emerald-600">Uploaded to partner&apos;s Drive folder ✓</p>}
          {!attachResult.copied && !attachResult.uploaded && attachResult.driveUrl && (
            <p className="text-[11px] text-amber-600">Saved with original URL (no Drive folder configured)</p>
          )}
          {attachResult.driveUrl && (
            <a href={attachResult.driveUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-im8-red hover:underline">Open in Drive ↗</a>
          )}
          <button onClick={() => {
            setAttachOpen(false); setAttachStatus("idle"); setAttachResult(null);
            setAttachDriveUrl(""); setAttachCaption(""); setAttachFile(null);
            setAttachVariantLabel(""); setAttachIsScript(false);
          }} className="text-[11px] text-im8-burgundy/50 hover:text-im8-burgundy underline">Attach another</button>
        </div>
      );
    }
    return (
      <div className="mt-2 p-3 bg-im8-sand/40 border border-im8-stone/30 rounded-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-im8-burgundy">{attachIsScript ? "Attach script / reference doc" : "Attach approved content"}</p>
          <button onClick={() => setAttachOpen(false)} className="text-im8-burgundy/40 hover:text-im8-burgundy text-xs">✕</button>
        </div>
        {/* Mode toggle */}
        <div className="flex gap-1">
          <button onClick={() => setAttachMode("link")}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${attachMode === "link" ? "bg-im8-burgundy text-white" : "bg-white border border-im8-stone/40 text-im8-burgundy/70 hover:text-im8-burgundy"}`}>
            Drive / web link
          </button>
          <button onClick={() => setAttachMode("file")}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${attachMode === "file" ? "bg-im8-burgundy text-white" : "bg-white border border-im8-stone/40 text-im8-burgundy/70 hover:text-im8-burgundy"}`}>
            Upload file
          </button>
        </div>

        {/* Variant label */}
        <div>
          <input
            type="text"
            value={attachVariantLabel}
            onChange={e => setAttachVariantLabel(e.target.value)}
            placeholder='Variant label (optional) — e.g. "Hook 1", "Body", "Full Reel 2"'
            className="w-full px-3 py-1.5 text-xs border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30"
          />
          <p className="text-[10px] text-im8-burgundy/40 mt-0.5">
            Use when one deliverable has multiple assets — different hooks, body shots, or alternates.
          </p>
        </div>

        {attachMode === "link" ? (
          <input
            type="url" value={attachDriveUrl}
            onChange={e => { setAttachDriveUrl(e.target.value); setAttachError(""); }}
            placeholder="https://drive.google.com/file/d/…"
            className="w-full px-3 py-1.5 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30"
          />
        ) : (
          <label className="block w-full border-2 border-dashed border-im8-stone/50 rounded-lg p-3 text-center cursor-pointer hover:border-im8-red/40 transition-colors">
            <input type="file" className="hidden" onChange={e => setAttachFile(e.target.files?.[0] ?? null)} />
            {attachFile ? (
              <span className="text-xs text-im8-burgundy font-medium">{attachFile.name}</span>
            ) : (
              <span className="text-xs text-im8-burgundy/50">Click to choose file</span>
            )}
          </label>
        )}

        <textarea
          value={attachCaption} onChange={e => setAttachCaption(e.target.value)}
          placeholder="Caption (optional)"
          rows={2}
          className="w-full px-3 py-1.5 text-sm border border-im8-stone/40 rounded-lg text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
        />

        {/* Script flag */}
        <label className="flex items-start gap-2 text-xs text-im8-burgundy cursor-pointer">
          <input
            type="checkbox"
            checked={attachIsScript}
            onChange={e => setAttachIsScript(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">This is a script / reference doc</span>
            <span className="block text-[10px] text-im8-burgundy/50 font-normal">
              Scripts skip the review queue and live in the deliverable&apos;s Drive subfolder for the team&apos;s reference.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAttach}
            disabled={attachStatus === "submitting" || (attachMode === "link" ? !attachDriveUrl : !attachFile)}
            className="px-3 py-1.5 text-xs font-medium bg-im8-red text-white rounded-lg hover:bg-im8-burgundy disabled:opacity-40 transition-colors"
          >
            {attachStatus === "submitting"
              ? "Saving…"
              : attachIsScript
              ? "Save script to Drive"
              : "Mark as done + save to Drive"}
          </button>
          {attachError && <span className="text-xs text-red-600">{attachError}</span>}
        </div>
        <p className="text-[11px] text-im8-burgundy/40">
          {attachIsScript
            ? "The doc will be copied to the deliverable's Drive folder. No review queue, no approval needed."
            : "The file will be copied to the deliverable's Drive folder and the deliverable marked as completed — no review needed."}
        </p>
      </div>
    );
  }

  // Local done state — lets us toggle without a full page reload
  const initialDone = ["approved", "live", "completed"].includes(
    (trackerRow?.status as string | undefined) ?? "",
  );
  const [isDone, setIsDone] = useState(initialDone);
  const [doneLoading, setDoneLoading] = useState(false);

  async function toggleDone() {
    if (doneLoading) return;
    setDoneLoading(true);
    const next = isDone ? "pending" : "live";
    try {
      let id = rowId;
      // If no tracker row yet, create one first via the deliverable-brief endpoint
      if (!id) {
        const res = await fetch(`/api/deals/${dealId}/deliverable-brief`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: deliverableType, sequence, brief_doc_url: null }),
        });
        if (res.ok) {
          const data = await res.json();
          id = data.id as string;
          setRowId(id);
        }
      }
      if (id) {
        await fetch(`/api/deliverables/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: next,
            live_date: next === "live" ? new Date().toISOString().split("T")[0] : null,
          }),
        });
        setIsDone(next === "live");
      }
    } catch (e) {
      console.error("toggleDone failed", e);
    }
    setDoneLoading(false);
  }
  const [sentMeta, setSentMeta] = useState<{
    sentAt: string;
    creatorDeadline: string;
    reviewDeadline: string;
    sentBy: string | null;
  } | null>(
    trackerRow?.brief_sent_at
      ? {
          sentAt: trackerRow.brief_sent_at,
          creatorDeadline: trackerRow.due_date ?? "",
          reviewDeadline: trackerRow.admin_review_due_date ?? "",
          sentBy: trackerRow.brief_sent_by?.full_name ?? null,
        }
      : null,
  );
  const isDirty = url.trim() !== savedUrl;

  // Save brief_doc_url — creates tracker row on-demand if it doesn't exist yet.
  async function handleSave(): Promise<string | null> {
    const next = url.trim();
    setSaveStatus("saving"); setErrorMsg("");
    try {
      let id = rowId;
      if (!id) {
        // No tracker row yet — call ensure+save endpoint which creates it and saves URL atomically
        const res = await fetch(`/api/deals/${dealId}/deliverable-brief`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: deliverableType, sequence, brief_doc_url: next || null }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMsg(data.error || `Error ${res.status}`);
          setSaveStatus("error");
          return null;
        }
        const data = await res.json();
        id = data.id as string;
        setRowId(id);
      } else {
        // Existing row — PATCH it directly
        const res = await fetch(`/api/deliverables/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief_doc_url: next || null }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMsg(data.error || `Error ${res.status}`);
          setSaveStatus("error");
          return null;
        }
      }
      setSavedUrl(next);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
      return id;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setSaveStatus("error");
      return null;
    }
  }

  async function handleSend() {
    const next = url.trim();
    if (!next) { setErrorMsg("Add the Google Doc link before sending."); return; }
    setErrorMsg("");
    // Save first (creates row if needed), get the row id
    let id = rowId;
    if (isDirty || !id) {
      id = await handleSave();
      if (!id) return; // save failed
    }
    setSendStatus("sending");
    try {
      const res = await fetch(`/api/deliverables/${id}/send-brief`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || `Send failed (${res.status})`);
        setSendStatus("error");
        return;
      }
      const result = await res.json();
      setSentMeta({
        sentAt: result.briefSentAt ?? new Date().toISOString(),
        creatorDeadline: result.creatorDeadline ?? "",
        reviewDeadline: result.reviewDeadline ?? "",
        sentBy: null, // populated on next page load from DB
      });
      setSendStatus("sent");
      setTimeout(() => setSendStatus("idle"), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setSendStatus("error");
    }
  }

  // Always include the sequence number — keeps "IGR #1" consistent with the
  // deliverables tracker so admins know exactly which row this brief maps to.
  const label = `${deliverableType} #${sequence}`;

  // If this deliverable is done, show a compact done row with an undo checkbox.
  if (isDone) {
    return (
      <>
      <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
        {/* Done checkbox — click to undo */}
        <button
          type="button"
          onClick={toggleDone}
          disabled={doneLoading}
          title="Mark as not done"
          className="w-5 h-5 rounded border-2 bg-emerald-500 border-emerald-500 text-white flex items-center justify-center hover:bg-red-400 hover:border-red-400 transition-colors shrink-0"
        >
          {doneLoading ? (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="shrink-0 w-24">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold font-mono bg-purple-100 text-purple-700">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            Completed
          </span>
          <span className="text-xs text-im8-burgundy/40 italic">click ✓ to undo</span>
          <button
            onClick={() => setAttachOpen(o => !o)}
            className="text-xs text-im8-burgundy/50 hover:text-im8-red underline transition-colors"
          >
            {attachOpen ? "Hide" : "Attach content"}
          </button>
        </div>
      </div>
      {attachOpen && (
        <div className="px-5 pb-3">
          <AttachPanel />
        </div>
      )}
      {rowId && (
        <div className="px-5 pb-3 pl-[6.5rem]">
          <DeliverableComments deliverableId={rowId} isAdminView />
        </div>
      )}
      </>
    );
  }

  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Done checkbox — click to mark as done */}
        <button
          type="button"
          onClick={toggleDone}
          disabled={doneLoading}
          title="Mark as done"
          className="w-5 h-5 rounded border-2 bg-white border-im8-stone hover:border-emerald-500 flex items-center justify-center transition-colors shrink-0"
        >
          {doneLoading && (
            <svg className="w-3 h-3 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
        </button>
        <div className="shrink-0 w-24">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold font-mono bg-purple-100 text-purple-700">
            {label}
          </span>
        </div>
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setErrorMsg(""); setSendStatus("idle"); }}
          placeholder="https://docs.google.com/document/d/…"
          className={`flex-1 min-w-0 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-im8-red/30 ${errorMsg ? "border-red-300 bg-red-50" : "border-im8-stone/40 text-im8-burgundy"}`}
        />
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-xs text-im8-red hover:underline">Open ↗</a>
        )}
      </div>
      <div className="flex items-center gap-2 pl-[6.5rem]">
        <button
          onClick={() => handleSave()}
          disabled={saveStatus === "saving" || !isDirty}
          className="px-3 py-1 text-xs font-medium bg-im8-sand border border-im8-stone/40 text-im8-burgundy rounded-lg hover:bg-im8-stone/20 disabled:opacity-40 transition-colors"
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save draft"}
        </button>
        <button
          onClick={handleSend}
          disabled={sendStatus === "sending" || saveStatus === "saving"}
          className="px-3 py-1 text-xs font-medium bg-im8-red text-white rounded-lg hover:bg-im8-burgundy disabled:opacity-40 transition-colors"
        >
          {sendStatus === "sending" ? "Sending…" : sendStatus === "sent" ? "Sent ✓" : sendStatus === "error" ? "Retry send" : "Send to influencer"}
        </button>
        {errorMsg && <span className="text-xs text-red-600">{errorMsg}</span>}
        {saveStatus === "error" && !errorMsg && <span className="text-xs text-red-600">Save failed</span>}
      </div>

      {/* Timestamp trail — shown once brief has been sent */}
      {sentMeta && (
        <div className="pl-[6.5rem] flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[11px] text-im8-burgundy/50">
            ✉ Sent{" "}
            {new Date(sentMeta.sentAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {sentMeta.sentBy && ` by ${sentMeta.sentBy}`}
          </span>
          {sentMeta.creatorDeadline && (
            <span className="text-[11px] text-amber-600 font-medium">
              Creator deadline: {new Date(sentMeta.creatorDeadline + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </span>
          )}
          {sentMeta.reviewDeadline && (
            <span className="text-[11px] text-blue-600 font-medium">
              Review by: {new Date(sentMeta.reviewDeadline + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      )}

      {/* Comments thread (visible whenever we have a tracker row) */}
      {rowId && (
        <div className="pl-[6.5rem]">
          <DeliverableComments deliverableId={rowId} isAdminView />
        </div>
      )}

      {/* Attach already-approved content */}
      <div className="pl-[6.5rem]">
        <button
          onClick={() => setAttachOpen(o => !o)}
          className="text-xs text-im8-burgundy/50 hover:text-im8-red underline transition-colors"
        >
          {attachOpen ? "Hide" : "Already have approved content? Attach it here →"}
        </button>
        {attachOpen && <div className="mt-1.5"><AttachPanel /></div>}
      </div>
    </div>
  );
}
