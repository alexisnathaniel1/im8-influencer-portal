"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Deal = Record<string, unknown>;
type Brief = Record<string, unknown>;
type Submission = Record<string, unknown>;

const STATUS_FLOW = ["contacted", "negotiating", "agreed", "pending_approval", "approved", "contracted", "live", "completed"];

export default function DealDetailClient({
  deal, briefs, submissions,
}: { deal: Deal; briefs: Brief[]; submissions: Submission[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "contract" | "briefs" | "submissions">("overview");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    influencerName: (deal.influencer_name as string) ?? "",
    influencerEmail: (deal.influencer_email as string) ?? "",
    agencyName: (deal.agency_name as string) ?? "",
    platformPrimary: (deal.platform_primary as string) ?? "instagram",
    monthlyRateCents: deal.monthly_rate_cents ? String(Number(deal.monthly_rate_cents) / 100) : "",
    totalMonths: String(deal.total_months ?? 3),
    rationale: (deal.rationale as string) ?? "",
    igHandle: (deal.instagram_handle as string) ?? "",
    tiktokHandle: (deal.tiktok_handle as string) ?? "",
    youtubeHandle: (deal.youtube_handle as string) ?? "",
    isGifted: Boolean(deal.is_gifted),
    giftedProduct: (deal.gifted_product as string) ?? "",
    giftedQuantity: String(deal.gifted_quantity ?? 1),
    productSentAt: (deal.product_sent_at as string) ?? "",
    needsApproval: deal.needs_approval !== false,
  });

  const [contract, setContract] = useState({
    campaignStart: (deal.campaign_start as string) ?? "",
    campaignEnd: (deal.campaign_end as string) ?? "",
    contractSignedAt: (deal.contract_signed_at as string) ?? "",
    contractUrl: (deal.contract_url as string) ?? "",
    paymentTerms: (deal.payment_terms as string) ?? "",
    contractRequirements: (deal.contract_requirements as string) ?? "",
    exclusivityClause: (deal.exclusivity_clause as string) ?? "",
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
        contract_signed_at: contract.contractSignedAt || null,
        contract_url: contract.contractUrl || null,
        payment_terms: contract.paymentTerms || null,
        contract_requirements: contract.contractRequirements || null,
        exclusivity_clause: contract.exclusivityClause || null,
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
        monthly_rate_cents: form.monthlyRateCents ? Math.round(parseFloat(form.monthlyRateCents) * 100) : null,
        total_months: parseInt(form.totalMonths),
        rationale: form.rationale,
        instagram_handle: form.igHandle.trim().replace(/^@/, "") || null,
        tiktok_handle: form.tiktokHandle.trim().replace(/^@/, "") || null,
        youtube_handle: form.youtubeHandle.trim().replace(/^@/, "") || null,
        is_gifted: form.isGifted,
        gifted_product: form.giftedProduct || null,
        gifted_quantity: parseInt(form.giftedQuantity) || 1,
        product_sent_at: form.productSentAt || null,
        needs_approval: form.needsApproval,
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
      <div className="flex gap-1 bg-im8-sand/50 rounded-xl p-1 w-fit">
        {(["overview", "contract", "briefs", "submissions"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-white text-im8-burgundy shadow-sm" : "text-im8-burgundy/50 hover:text-im8-burgundy"
            }`}>
            {t}
            {t === "briefs" && briefs.length > 0 && <span className="ml-1 text-xs">({briefs.length})</span>}
            {t === "submissions" && submissions.length > 0 && <span className="ml-1 text-xs">({submissions.length})</span>}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-5">
          {/* Toggles */}
          <div className="flex flex-wrap gap-6 pb-1 border-b border-im8-stone/20">
            <Toggle
              on={form.isGifted}
              onChange={v => setForm(f => ({ ...f, isGifted: v }))}
              label="Gifted collaboration (no payment)"
            />
            <Toggle
              on={!form.needsApproval}
              onChange={v => setForm(f => ({ ...f, needsApproval: !v }))}
              label="No approval needed"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Field label="Influencer name *" value={form.influencerName}
              onChange={v => setForm(f => ({ ...f, influencerName: v }))} />
            <div>
              <Field label="Email" value={form.influencerEmail}
                onChange={v => setForm(f => ({ ...f, influencerEmail: v }))} type="email" />
              {form.influencerEmail && (
                <InviteButton email={form.influencerEmail} />
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
            {!form.isGifted && <>
              <Field label="Monthly rate (USD) *" value={form.monthlyRateCents}
                onChange={v => setForm(f => ({ ...f, monthlyRateCents: v }))} type="number" />
              <Field label="Total months *" value={form.totalMonths}
                onChange={v => setForm(f => ({ ...f, totalMonths: v }))} type="number" />
            </>}
          </div>

          {/* Product section — always shown */}
          <div className="grid grid-cols-2 gap-5 p-4 bg-im8-sand/40 rounded-xl border border-im8-stone/20">
            <div className="col-span-2">
              <span className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">Product sent</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Product</label>
              <select value={form.giftedProduct} onChange={e => setForm(f => ({ ...f, giftedProduct: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none">
                <option value="">Select product...</option>
                <option value="Daily Ultimate Essentials">Daily Ultimate Essentials</option>
                <option value="Daily Ultimate Longevity">Daily Ultimate Longevity</option>
                <option value="Beckham Stack">Beckham Stack</option>
              </select>
            </div>
            <Field label="Quantity" value={form.giftedQuantity}
              onChange={v => setForm(f => ({ ...f, giftedQuantity: v }))} type="number" />
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Date sent</label>
              <input type="date" value={form.productSentAt}
                onChange={e => setForm(f => ({ ...f, productSentAt: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
          </div>

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
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Date signed</label>
              <input type="date" value={contract.contractSignedAt}
                onChange={e => setContract(c => ({ ...c, contractSignedAt: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Usage rights (months)</label>
              <input type="number" value={contract.usageRightsMonths}
                onChange={e => setContract(c => ({ ...c, usageRightsMonths: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
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
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Payment terms</label>
            <input type="text" value={contract.paymentTerms} placeholder="e.g. Net 30, 50% upfront, monthly on 1st..."
              onChange={e => setContract(c => ({ ...c, paymentTerms: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
          </div>

          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Exclusivity clause</label>
            <input type="text" value={contract.exclusivityClause} placeholder="e.g. No competing supplement brands for 6 months"
              onChange={e => setContract(c => ({ ...c, exclusivityClause: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
          </div>

          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Specific requirements</label>
            <textarea value={contract.contractRequirements} rows={4}
              placeholder="Disclosure requirements, posting schedule, approval windows, revision rounds, brand mentions, link-in-bio, anything specific to this contract..."
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
          <div className="flex justify-end">
            <button onClick={async () => {
              const res = await fetch("/api/briefs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dealId: deal.id }),
              });
              const { brief } = await res.json();
              if (brief?.id) router.push(`/admin/briefs/${brief.id}`);
            }} className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors">
              + Create brief
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
                      {b.status as string} · {b.platform as string} · Due {b.due_date ? new Date(b.due_date as string).toLocaleDateString() : "TBD"}
                    </div>
                  </div>
                  <Link href={`/admin/briefs/${b.id}`}
                    className="text-sm text-im8-red hover:underline">Edit →</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submissions tab */}
      {tab === "submissions" && (
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
              No submissions yet.
            </div>
          ) : (
            submissions.map(s => {
              const ai = (s.ai_reviews as Record<string, unknown>[] | null)?.[0];
              return (
                <div key={s.id as string} className="bg-white rounded-xl border border-im8-stone/30 p-5 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-im8-burgundy text-sm">{s.file_name as string}</div>
                    <div className="text-xs text-im8-burgundy/50 mt-1 capitalize">
                      {s.status as string} · {s.content_type as string}
                      {ai && ` · AI: ${ai.recommendation as string}`}
                    </div>
                  </div>
                  <Link href={`/admin/review/${s.id}`}
                    className="text-sm text-im8-red hover:underline">Review →</Link>
                </div>
              );
            })
          )}
        </div>
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

function InviteButton({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function sendInvite() {
    setStatus("sending");
    setErrorMsg("");
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Unknown error");
      setStatus("error");
    }
  }

  return (
    <div className="mt-1.5">
      <button type="button" onClick={sendInvite} disabled={status === "sending" || status === "sent"}
        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-60 ${
          status === "sent"
            ? "border-green-300 bg-green-50 text-green-700"
            : status === "error"
            ? "border-red-300 bg-red-50 text-red-600"
            : "border-im8-stone/40 text-im8-burgundy/60 hover:text-im8-burgundy hover:border-im8-stone/70"
        }`}>
        {status === "sending" ? "Sending..." : status === "sent" ? "Invite sent ✓" : status === "error" ? "Failed — retry" : "Send portal invite"}
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
