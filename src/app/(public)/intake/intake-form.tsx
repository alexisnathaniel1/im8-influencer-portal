"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NICHES = [
  "Doctor/Physician", "Dietitian/Nutritionist", "Athlete", "Biohacker",
  "Hyrox/CrossFit", "Wellness", "Longevity", "Fitness Coach",
  "Pilates", "Yoga", "Padel", "Pickleball", "Ironman", "Lifestyle", "Others",
];
const PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "other"] as const;
const POSITIONING_LIMIT = 100;

type Platform = typeof PLATFORMS[number];

interface DeliverableOption {
  id: string;
  code: string;
  label: string;
  platform: string;
  default_rate_cents: number | null;
}

interface ProposedDeliverable {
  code: string;
  count: number;
}

interface InfluencerEntry {
  key: string;
  influencerName: string;
  platformPrimary: Platform;
  igHandle: string;
  tiktokHandle: string;
  youtubeHandle: string;
  followerCount: string;
  proposedRate: string;
  positioning: string;
  niche: string[];
  othersNiche: string;
  proposedDeliverables: ProposedDeliverable[];
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
    positioning: "",
    niche: [],
    othersNiche: "",
    proposedDeliverables: [],
  };
}

interface Props {
  submitterName: string;
  submitterEmail: string;
  submitterAgency: string;
  partnerType: "creator" | "agency";
  deliverables: DeliverableOption[];
}

export default function IntakeForm({
  submitterName: initialSubmitterName,
  submitterEmail: initialSubmitterEmail,
  submitterAgency: initialSubmitterAgency,
  partnerType,
  deliverables,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitterName, setSubmitterName] = useState(initialSubmitterName);
  const [submitterEmail] = useState(initialSubmitterEmail); // locked to account email
  const [submitterAgency, setSubmitterAgency] = useState(initialSubmitterAgency);
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

  function toggleDeliverable(key: string, code: string) {
    setInfluencers(prev => prev.map(e => {
      if (e.key !== key) return e;
      const existing = e.proposedDeliverables.find(d => d.code === code);
      if (existing) {
        return { ...e, proposedDeliverables: e.proposedDeliverables.filter(d => d.code !== code) };
      }
      return { ...e, proposedDeliverables: [...e.proposedDeliverables, { code, count: 1 }] };
    }));
  }

  function setDeliverableCount(key: string, code: string, count: number) {
    setInfluencers(prev => prev.map(e => {
      if (e.key !== key) return e;
      return {
        ...e,
        proposedDeliverables: e.proposedDeliverables.map(d =>
          d.code === code ? { ...d, count: Math.max(1, count) } : d
        ),
      };
    }));
  }

  function addInfluencer() {
    setInfluencers(prev => [...prev, blankInfluencer()]);
  }

  function removeInfluencer(key: string) {
    setInfluencers(prev => prev.filter(e => e.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const inf of influencers) {
      if (inf.niche.length === 0) { setError("Select at least one niche for each creator."); return; }
      if (inf.niche.includes("Others") && !inf.othersNiche.trim()) {
        setError("Please specify when selecting 'Others' niche.");
        return;
      }
      if (!inf.positioning.trim()) { setError("Add a short positioning for each creator."); return; }
      if (inf.positioning.length > POSITIONING_LIMIT) { setError(`Positioning must be under ${POSITIONING_LIMIT} characters.`); return; }
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
          <h1 className="text-3xl font-bold text-white">
            {partnerType === "agency" ? "Submit creator profiles" : "Submit your profile"}
          </h1>
          <p className="mt-2 text-im8-stone">
            {partnerType === "agency"
              ? "Add one or more creators you represent — we'll review and respond within 5 business days."
              : "Tell us about yourself — we'll review and respond within 5 business days."}
          </p>
          <div className="mt-4">
            <Link href="/partner" className="text-xs text-white/70 hover:text-white underline">
              ← Back to dashboard
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-im8-burgundy mb-4">Your details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">Your name *</label>
                  <input type="text" required value={submitterName} onChange={e => setSubmitterName(e.target.value)}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">Your email</label>
                  <input type="email" value={submitterEmail} disabled
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy/60 bg-im8-sand/40 cursor-not-allowed" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">
                    {partnerType === "agency" ? "Agency name *" : "Agency name (if applicable)"}
                  </label>
                  <input type="text" required={partnerType === "agency"}
                    value={submitterAgency} onChange={e => setSubmitterAgency(e.target.value)}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                </div>
              </div>
            </div>

            <hr className="border-im8-stone/30" />

            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-im8-burgundy">
                {partnerType === "agency" ? `Creators (${influencers.length})` : "Your profile"}
              </h2>

              {influencers.map((inf, idx) => (
                <div key={inf.key} className="border border-im8-stone/30 rounded-xl p-5 space-y-4">
                  {partnerType === "agency" && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-im8-burgundy/60 uppercase tracking-wide">
                        Creator {influencers.length > 1 ? idx + 1 : ""}
                      </span>
                      {influencers.length > 1 && (
                        <button type="button" onClick={() => removeInfluencer(inf.key)}
                          className="text-xs text-im8-burgundy/40 hover:text-red-500 transition-colors">
                          Remove
                        </button>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">Creator name *</label>
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
                    {inf.niche.includes("Others") && (
                      <input type="text" value={inf.othersNiche}
                        onChange={e => updateInfluencer(inf.key, { othersNiche: e.target.value })}
                        placeholder="Please specify"
                        className="mt-3 w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">
                      Positioning * <span className="text-im8-burgundy/40 font-normal">({inf.positioning.length}/{POSITIONING_LIMIT})</span>
                    </label>
                    <textarea value={inf.positioning}
                      onChange={e => updateInfluencer(inf.key, { positioning: e.target.value.slice(0, POSITIONING_LIMIT) })}
                      placeholder="3 sentences introducing the creator's positioning and content style"
                      rows={3} maxLength={POSITIONING_LIMIT}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-2">Proposed deliverables</label>
                    <div className="space-y-2">
                      {deliverables.map(d => {
                        const selected = inf.proposedDeliverables.find(pd => pd.code === d.code);
                        return (
                          <div key={d.code} className="flex items-center gap-3">
                            <button type="button" onClick={() => toggleDeliverable(inf.key, d.code)}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                                selected ? "bg-im8-red/10 border-im8-red text-im8-burgundy border" : "bg-im8-sand border border-transparent text-im8-burgundy/70 hover:bg-im8-stone"
                              }`}>
                              <span className="font-medium">{d.label}</span>
                              <span className="ml-2 text-xs text-im8-burgundy/40 capitalize">{d.platform}</span>
                            </button>
                            {selected && (
                              <input type="number" min={1} value={selected.count}
                                onChange={e => setDeliverableCount(inf.key, d.code, parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {partnerType === "agency" && (
                <button type="button" onClick={addInfluencer}
                  className="w-full py-3 border-2 border-dashed border-im8-stone/40 rounded-xl text-sm font-medium text-im8-burgundy/60 hover:border-im8-red/40 hover:text-im8-red transition-colors">
                  + Add another creator
                </button>
              )}
            </div>

            <hr className="border-im8-stone/30" />

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
              {loading ? "Submitting..." : partnerType === "agency" && influencers.length > 1
                ? `Submit ${influencers.length} creators`
                : "Submit profile"}
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
