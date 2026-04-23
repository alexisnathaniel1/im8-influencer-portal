"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewDealPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get("profileId");
  const [loading, setLoading] = useState(false);
  const [isGifted, setIsGifted] = useState(false);
  const [form, setForm] = useState({
    influencerName: "", influencerEmail: "", agencyName: "",
    platformPrimary: "instagram", status: "contacted",
    igHandle: "", tiktokHandle: "", youtubeHandle: "",
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
          }));
        }
      });
    }
  }, [profileId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/deals/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        isGifted,
        status: isGifted ? "live" : form.status,
        discoveryProfileId: profileId,
      }),
    });
    const { id } = await res.json();
    router.push(`/admin/deals/${id}`);
  }

  return (
    <div className="max-w-lg animate-fade-in">
      <h1 className="text-2xl font-bold text-im8-burgundy mb-6">New deal</h1>
      <div className="bg-white rounded-xl border border-im8-stone/30 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Influencer name *</label>
            <input type="text" required value={form.influencerName}
              onChange={e => setForm(f => ({ ...f, influencerName: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Email</label>
            <input type="email" value={form.influencerEmail}
              onChange={e => setForm(f => ({ ...f, influencerEmail: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Agency (optional)</label>
            <input type="text" value={form.agencyName}
              onChange={e => setForm(f => ({ ...f, agencyName: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Primary platform</label>
            <select value={form.platformPrimary} onChange={e => setForm(f => ({ ...f, platformPrimary: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none">
              {["instagram", "tiktok", "youtube", "facebook", "other"].map(p => (
                <option key={p} value={p} className="capitalize">{p}</option>
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
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={isGifted} onChange={e => setIsGifted(e.target.checked)}
              className="w-4 h-4 accent-im8-red" />
            <span className="text-sm text-im8-burgundy font-medium">Gifted deal</span>
            {isGifted && (
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                Skips approval — starts live
              </span>
            )}
          </label>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
            {loading ? "Creating..." : "Create deal →"}
          </button>
        </form>
      </div>
    </div>
  );
}
