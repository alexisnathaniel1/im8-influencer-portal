"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NicheMultiSelect from "@/components/shared/niche-multi-select";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";

const DEAL_STATUSES = [
  { value: "live",       label: "Live — partnership is active now" },
  { value: "contracted", label: "Contracted — signed, not yet live" },
  { value: "agreed",     label: "Agreed — waiting on contract" },
  { value: "contacted",  label: "Contacted — still in early talks" },
  { value: "completed",  label: "Completed — collaboration finished" },
];

function NewPartnershipForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get("profileId");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    influencerName: "",
    influencerEmail: "",
    agencyName: "",
    platformPrimary: "instagram",
    igHandle: "",
    tiktokHandle: "",
    youtubeHandle: "",
    status: "live",
    monthlyRateUsd: "",
    totalMonths: "3",
    followerCount: "",
    currencyCode: "USD",
  });
  const [nicheTags, setNicheTags] = useState<string[]>([]);
  const [deliverableCounts, setDeliverableCounts] = useState<Record<string, number>>({});

  // Countable deliverables (episode / post / appearance counts)
  const COUNTABLE_OPTIONS = [
    { code: "IGR", label: "Instagram Reels" },
    { code: "IGS", label: "Instagram Stories" },
    { code: "IG_POST", label: "Instagram Feed Post" },
    { code: "TIKTOK", label: "TikTok Videos" },
    { code: "YT_DEDICATED", label: "YouTube Dedicated Review" },
    { code: "YT_INTEGRATED", label: "YouTube Integrated Review" },
    { code: "YT_PODCAST", label: "YouTube Podcast Ad Read" },
    { code: "YT_SHORTS", label: "YouTube Shorts" },
    { code: "UGC", label: "UGC Videos" },
    { code: "PODCAST_AD", label: "Podcast Ad Read" },
    { code: "NEWSLETTER", label: "Newsletter" },
    { code: "APP_PARTNERSHIP", label: "App Partnership" },
    { code: "BLOG", label: "Blog Post" },
    { code: "EVENT", label: "In-person Event / Appearance" },
    { code: "PRODUCTION_DAY", label: "Production / Capture Day" },
    { code: "MEDIA_INTERVIEW", label: "Media / Press Interview" },
  ];
  // Binary Yes/No rights / extras
  const BINARY_OPTIONS = [
    { code: "WHITELIST", label: "Whitelisting" },
    { code: "PAID_AD", label: "Paid Ad Usage Rights" },
    { code: "RAW_FOOTAGE", label: "Raw Footage" },
    { code: "LINK_BIO", label: "Link in Bio" },
  ];

  function setDeliverableCount(code: string, count: number) {
    setDeliverableCounts(prev => {
      if (count <= 0) {
        const next = { ...prev };
        delete next[code];
        return next;
      }
      return { ...prev, [code]: count };
    });
  }

  useEffect(() => {
    if (profileId) {
      fetch(`/api/discovery/${profileId}`).then(r => r.json()).then(({ profile }) => {
        if (profile) {
          setForm(f => ({
            ...f,
            influencerName: profile.influencer_name ?? "",
            influencerEmail: profile.submitter_email ?? "",
            agencyName: profile.agency_name ?? "",
            platformPrimary: profile.platform_primary ?? "instagram",
            igHandle: profile.instagram_handle ?? "",
            tiktokHandle: profile.tiktok_handle ?? "",
            youtubeHandle: profile.youtube_handle ?? "",
            monthlyRateUsd: profile.proposed_rate_cents ? String(profile.proposed_rate_cents / 100) : "",
            totalMonths: profile.total_months ? String(profile.total_months) : "3",
            followerCount: profile.follower_count ? String(profile.follower_count) : "",
          }));
          if (Array.isArray(profile.niche_tags)) setNicheTags(profile.niche_tags);
        }
      });
    }
  }, [profileId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const monthlyRateCents = form.monthlyRateUsd
      ? Math.round(parseFloat(form.monthlyRateUsd) * 100)
      : null;
    const totalMonths = parseInt(form.totalMonths) || 3;
    const followerCount = form.followerCount ? parseInt(form.followerCount) : null;

    const deliverables = Object.entries(deliverableCounts)
      .filter(([, count]) => count > 0)
      .map(([code, count]) => ({ code, count }));

    const res = await fetch("/api/deals/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        influencerName: form.influencerName,
        influencerEmail: form.influencerEmail,
        agencyName: form.agencyName,
        platformPrimary: form.platformPrimary,
        igHandle: form.igHandle,
        tiktokHandle: form.tiktokHandle,
        youtubeHandle: form.youtubeHandle,
        status: form.status,
        monthlyRateCents,
        totalMonths,
        currencyCode: form.currencyCode,
        followerCount,
        nicheTags,
        deliverables,
        discoveryProfileId: profileId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.id) {
      setError(data.error || "Failed to create partnership. Please try again.");
      setLoading(false);
      return;
    }
    router.push(`/admin/deals/${data.id}`);
  }

  const monthlyRate = parseFloat(form.monthlyRateUsd) || 0;
  const months = parseInt(form.totalMonths) || 3;
  const totalUsd = monthlyRate * months;

  return (
    <div className="max-w-lg animate-fade-in">
      <h1 className="text-2xl font-bold text-im8-burgundy mb-2">New partnership</h1>
      <p className="text-sm text-im8-burgundy/60 mb-6">
        Add an existing or new collaboration directly to the Partner Tracker.
      </p>
      <div className="bg-white rounded-xl border border-im8-stone/30 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Creator info */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">Creator info</p>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Creator / influencer name *</label>
              <input type="text" required value={form.influencerName}
                onChange={e => setForm(f => ({ ...f, influencerName: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Email</label>
                <input type="email" value={form.influencerEmail}
                  onChange={e => setForm(f => ({ ...f, influencerEmail: e.target.value }))}
                  placeholder="creator@example.com"
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Agency (optional)</label>
                <input type="text" value={form.agencyName}
                  onChange={e => setForm(f => ({ ...f, agencyName: e.target.value }))}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Primary platform</label>
              <select value={form.platformPrimary} onChange={e => setForm(f => ({ ...f, platformPrimary: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none">
                {["instagram", "tiktok", "youtube", "other"].map(p => (
                  <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Instagram", key: "igHandle" as const },
                { label: "TikTok", key: "tiktokHandle" as const },
                { label: "YouTube", key: "youtubeHandle" as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">{label}</label>
                  <input type="text" value={form[key]} placeholder="@handle"
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Followers (approx)</label>
                <input type="number" min="0" value={form.followerCount}
                  onChange={e => setForm(f => ({ ...f, followerCount: e.target.value }))}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                <p className="text-[11px] text-im8-burgundy/50 mt-1">Saved to the creator&apos;s profile for reuse on future contracts.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Niche tags</label>
                <NicheMultiSelect value={nicheTags} onChange={setNicheTags} />
              </div>
            </div>
          </div>

          <hr className="border-im8-stone/20" />

          {/* Deal terms */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">Deal terms</p>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Partnership status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none">
                {DEAL_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-3">
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Currency</label>
                <select value={form.currencyCode}
                  onChange={e => setForm(f => ({ ...f, currencyCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none bg-white">
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Monthly rate</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-im8-burgundy/50">{currencySymbol(form.currencyCode)}</span>
                  <input type="number" min="0" value={form.monthlyRateUsd}
                    onChange={e => setForm(f => ({ ...f, monthlyRateUsd: e.target.value }))}
                    placeholder="e.g. 3000"
                    className="w-full pl-8 pr-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Duration (months)</label>
                <input type="number" min="1" max="24" value={form.totalMonths}
                  onChange={e => setForm(f => ({ ...f, totalMonths: e.target.value }))}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
              </div>
            </div>
            {monthlyRate > 0 && (
              <p className="text-xs text-im8-burgundy/50 -mt-1">
                {currencySymbol(form.currencyCode)}{totalUsd.toLocaleString()} total over {months} month{months === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <hr className="border-im8-stone/20" />

          {/* Deliverables */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">Deliverables</p>
            <p className="text-xs text-im8-burgundy/50 -mt-1">Optional — you can also set these later from the deal page.</p>
            {/* Selected deliverables only — unselected codes accessible via
                + Add picker below to keep the form focused. */}
            <div className="space-y-2">
              {(() => {
                const selected = COUNTABLE_OPTIONS.filter(o => (deliverableCounts[o.code] ?? 0) > 0);
                const available = COUNTABLE_OPTIONS.filter(o => (deliverableCounts[o.code] ?? 0) === 0);
                return (
                  <>
                    {selected.length === 0 ? (
                      <p className="text-xs text-im8-burgundy/40 italic py-1">
                        No deliverables yet. Use <strong>+ Add deliverable</strong> below to add one.
                      </p>
                    ) : (
                      selected.map(({ code, label }) => {
                        const count = deliverableCounts[code] ?? 0;
                        return (
                          <div key={code} className="flex items-center gap-3 px-3 py-2 bg-im8-sand/30 border border-im8-stone/15 rounded-lg">
                            <span className="text-sm text-im8-burgundy font-medium flex-1">{label}</span>
                            <div className="flex items-center gap-1">
                              <button type="button"
                                onClick={() => setDeliverableCount(code, Math.max(0, count - 1))}
                                className="w-7 h-7 rounded border border-im8-stone/40 hover:bg-white text-im8-burgundy text-sm font-medium transition-colors">
                                −
                              </button>
                              <span className="w-8 text-center text-sm font-medium text-im8-burgundy">{count}</span>
                              <button type="button"
                                onClick={() => setDeliverableCount(code, count + 1)}
                                className="w-7 h-7 rounded border border-im8-stone/40 hover:bg-white text-im8-burgundy text-sm font-medium transition-colors">
                                +
                              </button>
                              <button type="button"
                                onClick={() => setDeliverableCount(code, 0)}
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
                    {available.length > 0 && (
                      <div className="pt-1">
                        <select
                          value=""
                          onChange={e => {
                            const code = e.target.value;
                            if (code) setDeliverableCount(code, 1);
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-im8-stone/50 bg-white text-im8-burgundy hover:border-im8-red/60 hover:text-im8-red transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-im8-red/30"
                        >
                          <option value="" disabled>+ Add deliverable…</option>
                          {available.map(({ code, label }) => (
                            <option key={code} value={code}>{label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            {/* Rights & extras — Yes/No toggles */}
            <div className="border-t border-im8-stone/10 pt-2 space-y-2">
              <p className="text-xs text-im8-burgundy/40 uppercase tracking-wide">Rights &amp; extras</p>
              {BINARY_OPTIONS.map(({ code, label }) => {
                const on = (deliverableCounts[code] ?? 0) > 0;
                return (
                  <div key={code} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-im8-burgundy">{label}</span>
                    <button
                      type="button"
                      onClick={() => setDeliverableCount(code, on ? 0 : 1)}
                      className="flex items-center gap-2.5"
                    >
                      <span className={`relative w-9 h-5 rounded-full transition-colors ${on ? "bg-im8-red" : "bg-im8-stone/40"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "left-4" : "left-0.5"}`} />
                      </span>
                      <span className="text-sm font-medium text-im8-burgundy">{on ? "Yes" : "No"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
            {loading ? "Creating…" : "Create partnership →"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewPartnershipPage() {
  return (
    <Suspense>
      <NewPartnershipForm />
    </Suspense>
  );
}
