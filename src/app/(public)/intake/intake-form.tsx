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

const STANDARD_DELIVERABLES_LABEL = "3 IG Reels · 3 IG Stories · Raw footage · Whitelisting · Paid ad usage rights · Link in bio · 3 UGC Videos for ads — across 3 months";

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
  positioning: string;
  niche: string;
  othersNiche: string;
  useStandardDeliverables: boolean;
  customDeliverables: string;
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
    niche: "",
    othersNiche: "",
    useStandardDeliverables: true,
    customDeliverables: "",
  };
}

interface Props {
  submitterName: string;
  submitterEmail: string;
  submitterAgency: string;
  partnerType: "creator" | "agency";
  deliverables: unknown[];
}

export default function IntakeForm({
  submitterName: initialSubmitterName,
  submitterEmail: initialSubmitterEmail,
  submitterAgency: initialSubmitterAgency,
  partnerType,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitterName, setSubmitterName] = useState(initialSubmitterName);
  const [submitterEmail] = useState(initialSubmitterEmail);
  const [submitterAgency, setSubmitterAgency] = useState(initialSubmitterAgency);
  const [influencers, setInfluencers] = useState<InfluencerEntry[]>([blankInfluencer()]);

  function updateInfluencer(key: string, patch: Partial<InfluencerEntry>) {
    setInfluencers(prev => prev.map(e => e.key === key ? { ...e, ...patch } : e));
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
      if (!inf.niche) { setError("Select a content niche for each creator."); return; }
      if (inf.niche === "Others" && !inf.othersNiche.trim()) {
        setError("Please specify the niche when selecting 'Others'.");
        return;
      }
      if (!inf.positioning.trim()) { setError("Add a short positioning for each creator."); return; }
      if (inf.positioning.length > POSITIONING_LIMIT) {
        setError(`Positioning must be under ${POSITIONING_LIMIT} characters.`);
        return;
      }
      if (!inf.useStandardDeliverables && !inf.customDeliverables.trim()) {
        setError("Please describe the proposed deliverables.");
        return;
      }
    }
    setLoading(true);
    setError("");

    // Map to the shape the API expects
    const influencersPayload = influencers.map(inf => ({
      ...inf,
      niche: [inf.niche],
      proposedDeliverables: inf.useStandardDeliverables
        ? [
            { code: "IGR", count: 3 },
            { code: "IGS", count: 3 },
            { code: "UGC", count: 3 },
            { code: "WHITELIST", count: 1 },
          ]
        : [],
      customDeliverables: inf.useStandardDeliverables ? null : inf.customDeliverables,
    }));

    const body = new FormData();
    body.append("submitterName", submitterName);
    body.append("submitterEmail", submitterEmail);
    body.append("submitterAgency", submitterAgency);
    body.append("influencers", JSON.stringify(influencersPayload));

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
            {/* Submitter details */}
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

            {/* Creator profiles */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-im8-burgundy">
                {partnerType === "agency" ? `Creators (${influencers.length})` : "Your profile"}
              </h2>

              {influencers.map((inf, idx) => (
                <div key={inf.key} className="border border-im8-stone/30 rounded-xl p-5 space-y-5">
                  {partnerType === "agency" && (
                    <div className="flex items-center justify-between">
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

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">Creator name *</label>
                    <input type="text" required value={inf.influencerName}
                      onChange={e => updateInfluencer(inf.key, { influencerName: e.target.value })}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                  </div>

                  {/* Platform */}
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

                  {/* Handles */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Instagram", key: "igHandle" as const },
                      { label: "TikTok", key: "tiktokHandle" as const },
                      { label: "YouTube", key: "youtubeHandle" as const },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-im8-burgundy mb-1">{label}</label>
                        <input type="text" value={inf[key]} placeholder="@handle"
                          onChange={e => updateInfluencer(inf.key, { [key]: e.target.value })}
                          className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                      </div>
                    ))}
                  </div>

                  {/* Followers */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">Followers (approx)</label>
                    <input type="number" value={inf.followerCount} placeholder="50000"
                      onChange={e => updateInfluencer(inf.key, { followerCount: e.target.value })}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                  </div>

                  {/* Niche — single select */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-2">Content niche *</label>
                    <div className="flex flex-wrap gap-2">
                      {NICHES.map(n => (
                        <button key={n} type="button"
                          onClick={() => updateInfluencer(inf.key, { niche: inf.niche === n ? "" : n })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            inf.niche === n ? "bg-im8-red text-white" : "bg-im8-sand text-im8-burgundy hover:bg-im8-stone"
                          }`}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {inf.niche === "Others" && (
                      <input type="text" value={inf.othersNiche}
                        onChange={e => updateInfluencer(inf.key, { othersNiche: e.target.value })}
                        placeholder="Please specify"
                        className="mt-3 w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                    )}
                  </div>

                  {/* Positioning */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">
                      Creator positioning * <span className="text-im8-burgundy/40 font-normal">({inf.positioning.length}/{POSITIONING_LIMIT})</span>
                    </label>
                    <textarea value={inf.positioning}
                      onChange={e => updateInfluencer(inf.key, { positioning: e.target.value.slice(0, POSITIONING_LIMIT) })}
                      placeholder="3 sentences introducing the creator's positioning and content style"
                      rows={3} maxLength={POSITIONING_LIMIT}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
                  </div>

                  {/* Standard deliverables */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-2">Deliverables</label>

                    {inf.useStandardDeliverables ? (
                      <div className="bg-im8-sand/60 border border-im8-stone/30 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Standard deliverables</p>
                        <p className="text-sm text-im8-burgundy leading-relaxed">{STANDARD_DELIVERABLES_LABEL}</p>
                        <button type="button"
                          onClick={() => updateInfluencer(inf.key, { useStandardDeliverables: false })}
                          className="text-xs text-im8-red hover:underline">
                          Propose different deliverables instead →
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea value={inf.customDeliverables}
                          onChange={e => updateInfluencer(inf.key, { customDeliverables: e.target.value })}
                          placeholder="Describe your proposed deliverables (e.g. 2 IG Reels, 1 TikTok video, whitelisting...)"
                          rows={3}
                          className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
                        <button type="button"
                          onClick={() => updateInfluencer(inf.key, { useStandardDeliverables: true, customDeliverables: "" })}
                          className="text-xs text-im8-burgundy/50 hover:text-im8-burgundy hover:underline">
                          ← Use standard deliverables instead
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Rates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">Proposed monthly rate (USD)</label>
                      <input type="number" value={inf.proposedRate} placeholder="2500" min={0}
                        onChange={e => updateInfluencer(inf.key, { proposedRate: e.target.value })}
                        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">Total rate — 3 months (USD)</label>
                      <input type="text" readOnly
                        value={inf.proposedRate ? `$${(parseFloat(inf.proposedRate) * 3).toLocaleString()}` : ""}
                        placeholder="Auto-calculated"
                        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy/60 bg-im8-sand/40 cursor-not-allowed" />
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
