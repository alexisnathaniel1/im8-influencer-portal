"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

const NICHES = ["Doctor/Physician", "Dietitian/Nutritionist", "Athlete", "Biohacker", "Hyrox/CrossFit", "Wellness", "Longevity", "Fitness Coach", "Other Health"];
const PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "other"] as const;

type Platform = typeof PLATFORMS[number];

interface InfluencerEntry {
  key: string;
  influencerName: string;
  platformPrimary: Platform;
  igHandle: string;
  tiktokHandle: string;
  youtubeHandle: string;
  followerCount: string;
  proposedRate: string;
  portfolioLinks: string;
  niche: string[];
  notes: string;
}

function blankInfluencer(): InfluencerEntry {
  return {
    key: Math.random().toString(36).slice(2),
    influencerName: "",
    platformPrimary: "instagram",
    igHandle: "",
    tiktokHandle: "",
    youtubeHandle: "",
    followerCount: "",
    proposedRate: "",
    portfolioLinks: "",
    niche: [],
    notes: "",
  };
}

export default function IntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterAgency, setSubmitterAgency] = useState("");
  const [influencers, setInfluencers] = useState<InfluencerEntry[]>([blankInfluencer()]);
  const [attachment, setAttachment] = useState<File | null>(null);

  function updateInfluencer(key: string, patch: Partial<InfluencerEntry>) {
    setInfluencers(prev => prev.map(e => e.key === key ? { ...e, ...patch } : e));
  }

  function toggleNiche(key: string, n: string) {
    setInfluencers(prev => prev.map(e =>
      e.key === key
        ? { ...e, niche: e.niche.includes(n) ? e.niche.filter(x => x !== n) : [...e.niche, n] }
        : e
    ));
  }

  function addInfluencer() {
    setInfluencers(prev => [...prev, blankInfluencer()]);
  }

  function removeInfluencer(key: string) {
    setInfluencers(prev => prev.filter(e => e.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (influencers.some(i => i.niche.length === 0)) {
      setError("Please select at least one niche for each influencer.");
      return;
    }
    setLoading(true);
    setError("");

    const body = new FormData();
    body.append("submitterName", submitterName);
    body.append("submitterEmail", submitterEmail);
    body.append("submitterAgency", submitterAgency);
    body.append("influencers", JSON.stringify(influencers));
    if (attachment) body.append("attachment", attachment);

    const res = await fetch("/api/intake/submit", { method: "POST", body });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Submission failed. Please try again.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    router.push(`/intake/success?submitted=${data.submitted}&duplicates=${data.duplicates}`);
  }

  return (
    <div className="min-h-screen bg-im8-burgundy py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-white/10 rounded-xl p-4">
              <Image src="/logo-white.svg" alt="IM8" width={80} height={40} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">Partner with IM8 Health</h1>
          <p className="mt-2 text-im8-stone">Submit one or more influencer profiles — we&apos;ll be in touch within 5 business days.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Submitter info */}
            <div>
              <h2 className="text-lg font-semibold text-im8-burgundy mb-4">Your details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">Your name *</label>
                  <input type="text" required value={submitterName} onChange={e => setSubmitterName(e.target.value)}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">Your email *</label>
                  <input type="email" required value={submitterEmail} onChange={e => setSubmitterEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">Agency name (if applicable)</label>
                  <input type="text" value={submitterAgency} onChange={e => setSubmitterAgency(e.target.value)}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                </div>
              </div>
            </div>

            <hr className="border-im8-stone/30" />

            {/* Influencer entries */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-im8-burgundy">
                Influencer{influencers.length > 1 ? "s" : ""} ({influencers.length})
              </h2>

              {influencers.map((inf, idx) => (
                <div key={inf.key} className="border border-im8-stone/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-im8-burgundy/60 uppercase tracking-wide">
                      Influencer {influencers.length > 1 ? idx + 1 : ""}
                    </span>
                    {influencers.length > 1 && (
                      <button type="button" onClick={() => removeInfluencer(inf.key)}
                        className="text-xs text-im8-burgundy/40 hover:text-red-500 transition-colors">
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">Influencer name *</label>
                    <input type="text" required value={inf.influencerName}
                      onChange={e => updateInfluencer(inf.key, { influencerName: e.target.value })}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-2">Primary platform *</label>
                    <div className="flex gap-2 flex-wrap">
                      {PLATFORMS.map(p => (
                        <button key={p} type="button"
                          onClick={() => updateInfluencer(inf.key, { platformPrimary: p })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                            inf.platformPrimary === p ? "bg-im8-red text-white" : "bg-im8-sand text-im8-burgundy hover:bg-im8-stone"
                          }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">Instagram</label>
                      <input type="text" value={inf.igHandle} placeholder="@handle"
                        onChange={e => updateInfluencer(inf.key, { igHandle: e.target.value })}
                        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">TikTok</label>
                      <input type="text" value={inf.tiktokHandle} placeholder="@handle"
                        onChange={e => updateInfluencer(inf.key, { tiktokHandle: e.target.value })}
                        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">YouTube</label>
                      <input type="text" value={inf.youtubeHandle} placeholder="@handle"
                        onChange={e => updateInfluencer(inf.key, { youtubeHandle: e.target.value })}
                        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">Followers (approx)</label>
                      <input type="number" value={inf.followerCount} placeholder="50000"
                        onChange={e => updateInfluencer(inf.key, { followerCount: e.target.value })}
                        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">Proposed monthly rate (USD)</label>
                      <input type="number" value={inf.proposedRate} placeholder="2500"
                        onChange={e => updateInfluencer(inf.key, { proposedRate: e.target.value })}
                        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-2">Niche / content category *</label>
                    <div className="flex flex-wrap gap-2">
                      {NICHES.map(n => (
                        <button key={n} type="button" onClick={() => toggleNiche(inf.key, n)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            inf.niche.includes(n) ? "bg-im8-red text-white" : "bg-im8-sand text-im8-burgundy hover:bg-im8-stone"
                          }`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">Portfolio / media kit links</label>
                    <textarea value={inf.portfolioLinks}
                      onChange={e => updateInfluencer(inf.key, { portfolioLinks: e.target.value })}
                      placeholder="Paste links separated by commas or newlines"
                      rows={2}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">Additional notes</label>
                    <textarea value={inf.notes}
                      onChange={e => updateInfluencer(inf.key, { notes: e.target.value })}
                      placeholder="Anything else we should know about this influencer?"
                      rows={2}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
                  </div>
                </div>
              ))}

              <button type="button" onClick={addInfluencer}
                className="w-full py-3 border-2 border-dashed border-im8-stone/40 rounded-xl text-sm font-medium text-im8-burgundy/60 hover:border-im8-red/40 hover:text-im8-red transition-colors">
                + Add another influencer
              </button>
            </div>

            <hr className="border-im8-stone/30" />

            {/* Shared attachment */}
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Pitch deck or media kit (optional)</label>
              <input type="file" accept=".pdf,.ppt,.pptx,.doc,.docx"
                onChange={e => setAttachment(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-im8-burgundy/70 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-im8-sand file:text-im8-burgundy file:font-medium hover:file:bg-im8-stone" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
              {loading ? "Submitting..." : `Submit ${influencers.length > 1 ? `${influencers.length} profiles` : "profile"}`}
            </button>
          </form>
        </div>

        <p className="text-center text-im8-stone/60 text-xs mt-6">
          We review all submissions and respond within 5 business days. Questions? Email{" "}
          <a href="mailto:creators@im8health.com" className="underline">creators@im8health.com</a>
        </p>
      </div>
    </div>
  );
}
