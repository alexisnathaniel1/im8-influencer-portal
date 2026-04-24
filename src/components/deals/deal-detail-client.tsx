"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NicheMultiSelect from "@/components/shared/niche-multi-select";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";

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
};

export default function DealDetailClient({
  deal, briefs, submissions, giftingRequests, deliverables = [], partnerShippingAddress, canViewRates = true, role = "",
}: {
  deal: Deal;
  briefs: Brief[];
  submissions: Submission[];
  giftingRequests: GiftingRequest[];
  deliverables?: DeliverableRow[];
  partnerShippingAddress: ShippingAddress | null;
  canViewRates?: boolean;
  role?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "contract" | "briefs" | "submissions" | "gifting" | "edited-videos">("overview");
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
      <div className="bg-white rounded-xl border border-im8-stone/30 p-5 flex items-center justify-between">
        <div className="flex items-center gap-4 overflow-x-auto pb-1">
          {STATUS_FLOW.map((s, i) => {
            const currentIdx = STATUS_FLOW.indexOf(status);
            const isDone = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <div className={`w-2 h-2 rounded-full ${isCurrent ? "bg-im8-red" : isDone ? "bg-green-500" : "bg-im8-stone"}`} />
                <span className={`text-xs capitalize ${isCurrent ? "font-semibold text-im8-burgundy" : isDone ? "text-green-600" : "text-im8-burgundy/40"}`}>
                  {s.replace("_", " ")}
                </span>
                {i < STATUS_FLOW.length - 1 && <span className="text-im8-stone ml-2">→</span>}
              </div>
            );
          })}
        </div>
        <StageButton status={status} dealId={deal.id as string} onRefresh={() => router.refresh()} onMarkAgreed={markAgreed} needsApproval={form.needsApproval} />
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
                {t === "briefs" && briefs.length > 0 && <span className="ml-1 text-xs">({briefs.length})</span>}
                {t === "submissions" && submissions.length > 0 && <span className="ml-1 text-xs">({submissions.length})</span>}
              </button>
            );
          })}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-5">
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

          {/* Contract & Deliverables — editable accordion (rate, months, gifted, deliverables) */}
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

          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Rationale * (shown to managers)</label>
            <textarea value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))}
              rows={3} placeholder="Why this influencer? Niche fit, audience quality, past performance..."
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
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

          {/* Follower count + niche */}
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

          {/* Discount code + affiliate link — visible to creators in their dashboard */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Discount code</label>
              <input type="text" value={form.discountCode} placeholder="e.g. IM8ALEX20"
                onChange={e => setForm(f => ({ ...f, discountCode: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 font-mono" />
              <p className="text-xs text-im8-burgundy/40 mt-0.5">Shown to the creator in their portal.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Affiliate / tracking link</label>
              <input type="url" value={form.affiliateLink} placeholder="https://im8.com/?ref=..."
                onChange={e => setForm(f => ({ ...f, affiliateLink: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
              {form.affiliateLink && (
                <a href={form.affiliateLink} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-im8-red hover:underline mt-0.5 inline-block">Test link ↗</a>
              )}
            </div>
          </div>

          {/* Portal access */}
          <div className="p-4 bg-im8-sand/40 rounded-xl border border-im8-stone/20 space-y-3">
            <span className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">Portal access</span>
            <LinkProfileSection dealId={deal.id as string} currentProfileId={deal.influencer_profile_id as string | null} driveFolderId={deal.drive_folder_id as string | null} />
          </div>

          <div className="flex justify-between items-center pt-2">
            <button onClick={saveOverview} disabled={saving}
              className={`ml-auto px-5 py-2 text-white text-sm rounded-lg disabled:opacity-50 transition-colors ${saved ? "bg-green-600 hover:bg-green-700" : "bg-im8-red hover:bg-im8-burgundy"}`}>
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
            </button>
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

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Campaign start</label>
              <input type="date" value={contract.campaignStart}
                onChange={e => setContract(c => ({ ...c, campaignStart: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Campaign end</label>
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
          <div className="flex items-center justify-between gap-4">
            {briefCreateError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex-1">{briefCreateError}</p>
            )}
            <button
              disabled={creatingBrief}
              onClick={async () => {
                setCreatingBrief(true);
                setBriefCreateError("");
                try {
                  const res = await fetch("/api/briefs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ dealId: deal.id }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setBriefCreateError(data.error || `Error ${res.status} — could not create brief`);
                    setCreatingBrief(false);
                    return;
                  }
                  const { brief } = await res.json();
                  if (brief?.id) {
                    router.push(`/admin/briefs/${brief.id}`);
                  } else {
                    setBriefCreateError("Brief created but no ID returned — please refresh");
                    setCreatingBrief(false);
                  }
                } catch (err) {
                  setBriefCreateError(err instanceof Error ? err.message : "Network error — please try again");
                  setCreatingBrief(false);
                }
              }}
              className="ml-auto px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy disabled:opacity-60 transition-colors">
              {creatingBrief ? "Creating…" : "+ Create brief"}
            </button>
          </div>
          {briefs.length === 0 ? (
            <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
              No briefs yet. Create the first brief for this influencer.
            </div>
          ) : (
            <div className="space-y-3">
              {briefs.map(b => (
                <div key={b.id as string} className="bg-white rounded-xl border border-im8-stone/30 p-5 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-im8-burgundy">{b.title as string}</div>
                    <div className="text-xs text-im8-burgundy/50 mt-1 capitalize">
                      {b.status as string}
                      {b.platform ? ` · ${b.platform as string}` : ""}
                      {b.due_date ? ` · Due ${new Date(b.due_date as string).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link href={`/admin/briefs/${b.id}`}
                      className="text-sm text-im8-red hover:underline">Edit →</Link>
                    <DeleteBriefButton briefId={b.id as string} onDeleted={() => router.refresh()} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Per-deliverable brief URLs — Denis pastes a Google Doc link per row */}
          {deliverables.length > 0 && (
            <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-im8-burgundy">Per-deliverable briefs</h3>
                  <p className="text-xs text-im8-burgundy/50">
                    Paste a Google Doc link for each individual deliverable. These appear to the creator when they upload content for that row.
                  </p>
                </div>
              </div>
              <DeliverableBriefList deliverables={deliverables} />
            </div>
          )}
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
          {submissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
              No submissions yet.
            </div>
          ) : (
            submissions.map(s => (
              <div key={s.id as string} className="bg-white rounded-xl border border-im8-stone/30 p-5 flex items-center justify-between">
                <div>
                  <div className="font-medium text-im8-burgundy text-sm">{s.file_name as string}</div>
                  <div className="text-xs text-im8-burgundy/50 mt-1 capitalize">
                    {s.status as string} · {s.content_type as string}
                  </div>
                  {Boolean(s.feedback) && (
                    <div className="mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">{s.feedback as string}</div>
                  )}
                </div>
                <Link href={`/admin/review`}
                  className="text-sm text-im8-red hover:underline">Review queue →</Link>
              </div>
            ))
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

// Deliverable label map — exported so the brief editor and new-deal form can reuse it.
export const DELIVERABLE_LABELS: Record<string, string> = {
  // Instagram
  IGR: "Instagram Reels",
  IGS: "Instagram Stories",
  // TikTok
  TIKTOK: "TikTok Videos",
  // YouTube (broken down by format)
  YT_DEDICATED: "YouTube Dedicated Review",
  YT_INTEGRATED: "YouTube Integrated Review",
  YT_PODCAST: "YouTube Podcast Ad Read",
  // UGC
  UGC: "UGC Videos",
  // Other platforms / formats
  NEWSLETTER: "Newsletter",
  APP_PARTNERSHIP: "App Partnership",
  BLOG: "Blog Post",
  // Rights / extras — rendered as Yes/No toggles, excluded from content briefs
  WHITELIST: "Whitelisting",
  PAID_AD: "Paid Ad Usage Rights",
  RAW_FOOTAGE: "Raw Footage",
  LINK_BIO: "Link in Bio",
};

// Codes that are binary Yes/No grants rather than countable deliverables.
export const BINARY_DELIVERABLE_CODES = new Set(["WHITELIST", "PAID_AD", "RAW_FOOTAGE", "LINK_BIO"]);

// Codes that are rights/extras — excluded from the content brief deliverable list.
// Denis (support) writes the brief for the actual content deliverables only.
export const BRIEF_EXCLUDED_CODES = new Set(["WHITELIST", "PAID_AD", "RAW_FOOTAGE", "LINK_BIO"]);

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
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            Contract {seq}
          </span>
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

            {/* Countable deliverables */}
            <div className="space-y-2.5 mb-4">
              {Object.entries(DELIVERABLE_LABELS)
                .filter(([code]) => !BINARY_DELIVERABLE_CODES.has(code))
                .map(([code, label]) => {
                  const count = deliverableCounts[code] ?? 0;
                  return (
                    <div key={code} className="flex items-center gap-3">
                      <span className="text-sm text-im8-burgundy flex-1">{label}</span>
                      <div className="flex items-center gap-1.5">
                        <button type="button"
                          onClick={() => setCount(code, Math.max(0, count - 1))}
                          disabled={count === 0}
                          className={`w-7 h-7 rounded border text-sm font-medium transition-colors ${count > 0 ? "border-im8-stone/40 hover:bg-im8-sand text-im8-burgundy" : "border-im8-stone/20 text-im8-burgundy/20 cursor-not-allowed"}`}>
                          −
                        </button>
                        <span className={`w-8 text-center text-sm font-semibold tabular-nums ${count > 0 ? "text-im8-burgundy" : "text-im8-burgundy/25"}`}>
                          {count}
                        </span>
                        <button type="button"
                          onClick={() => setCount(code, count + 1)}
                          className="w-7 h-7 rounded border border-im8-stone/40 hover:bg-im8-sand text-im8-burgundy text-sm font-medium transition-colors">
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
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

function StageButton({ status, dealId, onRefresh, onMarkAgreed, needsApproval }: {
  status: string; dealId: string; onRefresh: () => void; onMarkAgreed: () => void; needsApproval: boolean;
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
  if (status === "approved")
    return btn("Move to contracted →", () => advance("contracted"), "bg-purple-600 hover:bg-purple-700");
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

      {currentProfileId && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-im8-burgundy/60">
            {driveFolderId ? "Sub-folder created ✓" : "No talent sub-folder yet"}
          </span>
          {!driveFolderId && (
            <button onClick={createSubFolder} disabled={subFolderStatus === "creating" || subFolderStatus === "created"}
              className="text-xs px-2.5 py-1 border border-im8-stone/40 rounded-lg text-im8-burgundy/60 hover:text-im8-burgundy hover:border-im8-stone/70 disabled:opacity-50 transition-colors">
              {subFolderStatus === "creating" ? "Creating…" : subFolderStatus === "created" ? "Created ✓" : "Create sub-folder"}
            </button>
          )}
        </div>
      )}

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
function DeliverableBriefList({ deliverables }: { deliverables: DeliverableRow[] }) {
  return (
    <div className="divide-y divide-im8-stone/20 -mx-5">
      {deliverables.map(d => (
        <DeliverableBriefRow key={d.id} deliverable={d} />
      ))}
    </div>
  );
}

function DeliverableBriefRow({ deliverable }: { deliverable: DeliverableRow }) {
  const [url, setUrl] = useState(deliverable.brief_doc_url ?? "");
  const [savedUrl, setSavedUrl] = useState(deliverable.brief_doc_url ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const isDirty = url.trim() !== savedUrl;

  async function handleSave() {
    const next = url.trim();
    setSaveStatus("saving"); setErrorMsg("");
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_doc_url: next || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || `Error ${res.status}`);
        setSaveStatus("error");
        return;
      }
      setSavedUrl(next);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setSaveStatus("error");
    }
  }

  async function handleSend() {
    const next = url.trim();
    if (!next) { setErrorMsg("Add the Google Doc link before sending."); return; }
    setErrorMsg("");
    // Save first if dirty
    if (isDirty) {
      setSaveStatus("saving");
      const saveRes = await fetch(`/api/deliverables/${deliverable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_doc_url: next }),
      }).catch(() => null);
      if (!saveRes?.ok) {
        setSaveStatus("error"); setErrorMsg("Could not save the link — check your connection.");
        return;
      }
      setSavedUrl(next);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    }
    setSendStatus("sending");
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}/send-brief`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || `Send failed (${res.status})`);
        setSendStatus("error");
        return;
      }
      setSendStatus("sent");
      setTimeout(() => setSendStatus("idle"), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setSendStatus("error");
    }
  }

  const label = `${deliverable.deliverable_type}${deliverable.sequence ? ` #${deliverable.sequence}` : ""}`;
  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
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
          onClick={handleSave}
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
    </div>
  );
}
