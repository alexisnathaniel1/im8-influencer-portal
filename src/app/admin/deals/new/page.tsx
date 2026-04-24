"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  });

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
          }));
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Monthly rate (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-im8-burgundy/50">$</span>
                  <input type="number" min="0" value={form.monthlyRateUsd}
                    onChange={e => setForm(f => ({ ...f, monthlyRateUsd: e.target.value }))}
                    placeholder="e.g. 3000"
                    className="w-full pl-7 pr-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
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
                ${totalUsd.toLocaleString()} total over {months} month{months === 1 ? "" : "s"}
              </p>
            )}
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
