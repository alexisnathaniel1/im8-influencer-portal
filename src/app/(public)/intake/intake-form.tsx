"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DELIVERABLE_LABELS } from "@/lib/deliverables";

const NICHES = [
  "Doctor/Physician", "Dietitian/Nutritionist", "Athlete", "Biohacker",
  "Hyrox/CrossFit", "Wellness", "Longevity", "Fitness Coach",
  "Pilates", "Yoga", "Padel", "Pickleball", "Ironman", "Lifestyle", "Others",
];
const PLATFORMS = ["instagram", "tiktok", "youtube", "other"] as const;
const POSITIONING_LIMIT = 100;

// DELIVERABLE_LABELS imported from @/lib/deliverables
const STANDARD_USAGE_RIGHTS = ["Whitelisting", "Paid ad usage rights", "Link in bio"];

type Platform = typeof PLATFORMS[number];
type Deliverable = { code: string; count: number };

interface InfluencerEntry {
  key: string;
  influencerName: string;
  platformPrimary: Platform;
  igHandle: string;
  tiktokHandle: string;
  youtubeHandle: string;
  followerCount: string;
  proposedRate: string;
  totalMonths: string;
  positioning: string;
  niche: string;
  othersNiche: string;
  deliverables: Deliverable[];
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
    totalMonths: "3",
    positioning: "",
    niche: "",
    othersNiche: "",
    deliverables: [
      { code: "IGR", count: 3 },
      { code: "IGS", count: 3 },
      { code: "UGC", count: 3 },
    ],
  };
}

interface Props {
  submitterName: string;
  submitterEmail: string;
  submitterAgency: string;
  partnerType: "creator" | "agency";
  deliverables: unknown[];
  isAdmin?: boolean;
}

export default function IntakeForm({
  submitterName: initialSubmitterName,
  submitterEmail: initialSubmitterEmail,
  submitterAgency: initialSubmitterAgency,
  partnerType,
  isAdmin = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitterName, setSubmitterName] = useState(initialSubmitterName);
  const [submitterEmail, setSubmitterEmail] = useState(initialSubmitterEmail);
  const [submitterAgency, setSubmitterAgency] = useState(initialSubmitterAgency);
  const [influencers, setInfluencers] = useState<InfluencerEntry[]>([blankInfluencer()]);

  // Admin-only: toggle whether this submission is for a creator or an agency
  const [adminSubType, setAdminSubType] = useState<"creator" | "agency">("creator");

  // Effective type: what drives multi-add and label behaviour
  const effectiveType: "creator" | "agency" = isAdmin ? adminSubType : partnerType;
  const isMulti = effectiveType === "agency";

  function updateInfluencer(key: string, patch: Partial<InfluencerEntry>) {
    setInfluencers(prev => prev.map(e => e.key === key ? { ...e, ...patch } : e));
  }

  function addInfluencer() {
    setInfluencers(prev => [...prev, blankInfluencer()]);
  }

  function removeInfluencer(key: string) {
    if (influencers.length === 1) return;
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
      if (!inf.deliverables.length) {
        setError("Add at least one deliverable for each creator.");
        return;
      }
      const months = parseInt(inf.totalMonths);
      if (!Number.isFinite(months) || months < 1 || months > 24) {
        setError("Duration must be between 1 and 24 months.");
        return;
      }
    }
    setLoading(true);
    setError("");

    const influencersPayload = influencers.map(inf => ({
      ...inf,
      niche: [inf.niche],
      proposedDeliverables: inf.deliverables,
      totalMonths: parseInt(inf.totalMonths) || 3,
    }));

    const body = new FormData();
    body.append("submitterName", submitterName);
    body.append("submitterEmail", submitterEmail);
    body.append("submitterAgency", submitterAgency);
    body.append("submissionType", effectiveType);
    body.append("source", isAdmin ? "admin_manual" : "inbound_form");
    body.append("influencers", JSON.stringify(influencersPayload));

    const res = await fetch("/api/intake/submit", { method: "POST", body });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Submission failed. Please try again.");
      setLoading(false);
      return;
    }
    const data = await res.json();

    // Surface insert-level errors (e.g. DB constraint violations)
    if (data.insertErrors?.length > 0 && data.submitted === 0) {
      setError(`Submission failed: ${data.insertErrors[0].error}`);
      setLoading(false);
      return;
    }

    if (isAdmin) {
      // Send admin straight back to Discovery with a success indicator
      router.push(`/admin/discovery?submitted=${data.submitted}&duplicates=${data.duplicates}`);
    } else {
      router.push(`/intake/success?submitted=${data.submitted}&duplicates=${data.duplicates}`);
    }
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
            {isAdmin
              ? "Add to Discovery"
              : effectiveType === "agency"
                ? "Submit creator profiles"
                : "Submit your profile"}
          </h1>
          <p className="mt-2 text-im8-stone">
            {isAdmin
              ? "Manually add a creator or agency to the Discovery pipeline."
              : effectiveType === "agency"
                ? "Add one or more creators you represent — we'll review and respond within 5 business days."
                : "Tell us about yourself — we'll review and respond within 5 business days."}
          </p>
          <div className="mt-4">
            <Link
              href={isAdmin ? "/admin/discovery" : "/partner"}
              className="text-xs text-white/70 hover:text-white underline"
            >
              ← {isAdmin ? "Back to Discovery" : "Back to dashboard"}
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Admin: creator vs agency toggle */}
          {isAdmin && (
            <div>
              <p className="text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide mb-2">Submission type</p>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-im8-sand p-1">
                <button
                  type="button"
                  onClick={() => { setAdminSubType("creator"); setInfluencers([blankInfluencer()]); }}
                  className={`py-2 text-sm font-medium rounded-md transition-colors ${
                    adminSubType === "creator" ? "bg-white text-im8-burgundy shadow-sm" : "text-im8-burgundy/60 hover:text-im8-burgundy"
                  }`}
                >
                  Creator (individual)
                </button>
                <button
                  type="button"
                  onClick={() => setAdminSubType("agency")}
                  className={`py-2 text-sm font-medium rounded-md transition-colors ${
                    adminSubType === "agency" ? "bg-white text-im8-burgundy shadow-sm" : "text-im8-burgundy/60 hover:text-im8-burgundy"
                  }`}
                >
                  Agency (multiple)
                </button>
              </div>
              <p className="mt-2 text-xs text-im8-burgundy/40">
                {adminSubType === "agency"
                  ? "Agency mode — you can add multiple creator profiles under one agency submission."
                  : "Creator mode — single profile. Switch to Agency to submit multiple creators at once."}
              </p>
            </div>
          )}

          {/* Partner type toggle — only for external (non-admin) partners */}
          {!isAdmin && !partnerType && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-im8-sand p-1">
              <button type="button"
                className="py-2 text-sm font-medium rounded-md bg-white text-im8-burgundy shadow-sm">
                I&apos;m a creator
              </button>
              <button type="button"
                className="py-2 text-sm font-medium rounded-md text-im8-burgundy/60 hover:text-im8-burgundy">
                I&apos;m an agency
              </button>
            </div>
          )}

          {!isAdmin && effectiveType === "agency" && (
            <div className="bg-im8-sand/60 border border-im8-stone/30 text-im8-burgundy/80 px-4 py-3 rounded-lg text-xs">
              Tip: you&apos;ll be able to submit more creator profiles later from your dashboard.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Submitter details */}
            <div>
              <h2 className="text-lg font-semibold text-im8-burgundy mb-4">
                {isAdmin ? "Submitter / contact details" : "Your details"}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">
                    {isAdmin ? "Contact name *" : "Your name *"}
                  </label>
                  <input
                    type="text" required value={submitterName}
                    onChange={e => setSubmitterName(e.target.value)}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">
                    {isAdmin ? "Contact email *" : "Your email"}
                  </label>
                  {isAdmin ? (
                    <input
                      type="email" required value={submitterEmail}
                      onChange={e => setSubmitterEmail(e.target.value)}
                      placeholder="agency@example.com"
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                    />
                  ) : (
                    <input
                      type="email" value={submitterEmail} disabled
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy/60 bg-im8-sand/40 cursor-not-allowed"
                    />
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">
                    {effectiveType === "agency"
                      ? "Agency name *"
                      : isAdmin
                        ? "Agency name (if applicable)"
                        : "Agency name (if applicable)"}
                  </label>
                  <input
                    type="text"
                    required={effectiveType === "agency"}
                    value={submitterAgency}
                    onChange={e => setSubmitterAgency(e.target.value)}
                    placeholder={effectiveType === "agency" ? "Agency / talent company name" : "Leave blank if none"}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                  />
                </div>
              </div>
            </div>

            <hr className="border-im8-stone/30" />

            {/* Creator profiles */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-im8-burgundy">
                {isMulti ? `Creators (${influencers.length})` : "Creator profile"}
              </h2>

              {influencers.map((inf, idx) => (
                <div key={inf.key} className="border border-im8-stone/30 rounded-xl p-5 space-y-5">
                  {isMulti && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-im8-burgundy/60 uppercase tracking-wide">
                        Creator {influencers.length > 1 ? idx + 1 : ""}
                      </span>
                      {influencers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInfluencer(inf.key)}
                          className="text-xs text-im8-burgundy/40 hover:text-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">Creator name *</label>
                    <input
                      type="text" required value={inf.influencerName}
                      onChange={e => updateInfluencer(inf.key, { influencerName: e.target.value })}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                    />
                  </div>

                  {/* Platform */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-2">Primary platform *</label>
                    <div className="flex gap-2 flex-wrap">
                      {PLATFORMS.map(p => (
                        <button key={p} type="button"
                          onClick={() => updateInfluencer(inf.key, { platformPrimary: p })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                            inf.platformPrimary === p
                              ? "bg-im8-red text-white"
                              : "bg-im8-sand text-im8-burgundy hover:bg-im8-stone"
                          }`}
                        >
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
                        <input
                          type="text" value={inf[key]} placeholder="@handle"
                          onChange={e => updateInfluencer(inf.key, { [key]: e.target.value })}
                          className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Followers */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">Followers (approx)</label>
                    <input
                      type="number" value={inf.followerCount} placeholder="50000"
                      onChange={e => updateInfluencer(inf.key, { followerCount: e.target.value })}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                    />
                  </div>

                  {/* Niche */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-2">Content niche *</label>
                    <div className="flex flex-wrap gap-2">
                      {NICHES.map(n => (
                        <button key={n} type="button"
                          onClick={() => updateInfluencer(inf.key, { niche: inf.niche === n ? "" : n })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            inf.niche === n
                              ? "bg-im8-red text-white"
                              : "bg-im8-sand text-im8-burgundy hover:bg-im8-stone"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {inf.niche === "Others" && (
                      <input
                        type="text" value={inf.othersNiche}
                        onChange={e => updateInfluencer(inf.key, { othersNiche: e.target.value })}
                        placeholder="Please specify"
                        className="mt-3 w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                      />
                    )}
                  </div>

                  {/* Positioning */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-1">
                      Creator positioning *{" "}
                      <span className="text-im8-burgundy/40 font-normal">({inf.positioning.length}/{POSITIONING_LIMIT})</span>
                    </label>
                    <textarea
                      value={inf.positioning}
                      onChange={e => updateInfluencer(inf.key, { positioning: e.target.value.slice(0, POSITIONING_LIMIT) })}
                      placeholder="3 sentences introducing the creator's positioning and content style"
                      rows={3} maxLength={POSITIONING_LIMIT}
                      className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none"
                    />
                  </div>

                  {/* Deliverables — structured rows */}
                  <div>
                    <label className="block text-sm font-medium text-im8-burgundy mb-2">Proposed deliverables *</label>
                    <div className="space-y-2">
                      {inf.deliverables.map((d, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={d.code}
                            onChange={e => updateInfluencer(inf.key, {
                              deliverables: inf.deliverables.map((x, i) => i === idx ? { ...x, code: e.target.value } : x)
                            })}
                            className="flex-1 px-2 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none bg-white"
                          >
                            {["IGR","IGS","IG_POST","TIKTOK","YT_DEDICATED","YT_INTEGRATED","YT_PODCAST","YT_SHORTS","UGC","PODCAST_AD","NEWSLETTER","BLOG","EVENT","PRODUCTION_DAY","MEDIA_INTERVIEW"].map(c => (
                              <option key={c} value={c}>{DELIVERABLE_LABELS[c] ?? c}</option>
                            ))}
                          </select>
                          <input
                            type="number" min="1" max="20" value={d.count}
                            onChange={e => updateInfluencer(inf.key, {
                              deliverables: inf.deliverables.map((x, i) => i === idx ? { ...x, count: parseInt(e.target.value) || 1 } : x)
                            })}
                            className="w-16 px-2 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy text-center focus:outline-none"
                          />
                          {inf.deliverables.length > 1 && (
                            <button
                              type="button"
                              onClick={() => updateInfluencer(inf.key, {
                                deliverables: inf.deliverables.filter((_, i) => i !== idx)
                              })}
                              className="text-im8-burgundy/40 hover:text-red-500 text-lg leading-none px-1"
                              aria-label="Remove deliverable"
                            >×</button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateInfluencer(inf.key, {
                          deliverables: [...inf.deliverables, { code: "IGR", count: 1 }]
                        })}
                        className="text-xs text-im8-red hover:text-im8-burgundy font-medium"
                      >+ Add deliverable</button>
                    </div>
                    <div className="mt-3 bg-im8-sand/60 border border-im8-stone/30 rounded-lg px-3 py-2 text-xs text-im8-burgundy/70">
                      <span className="font-semibold text-im8-burgundy/60">Usage rights included as standard:</span>{" "}
                      {STANDARD_USAGE_RIGHTS.join(" · ")}
                    </div>
                  </div>

                  {/* Rate + Duration + Total */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">Monthly rate (USD) *</label>
                      <input
                        type="number" value={inf.proposedRate} placeholder="2500" min={0} required
                        onChange={e => updateInfluencer(inf.key, { proposedRate: e.target.value })}
                        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">Duration *</label>
                      <div className="relative">
                        <input
                          type="number" min={1} max={24} value={inf.totalMonths} required
                          onChange={e => updateInfluencer(inf.key, { totalMonths: e.target.value })}
                          className="w-full pl-3 pr-14 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-im8-burgundy/50 pointer-events-none">months</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-im8-burgundy mb-1">Total (auto)</label>
                      <input
                        type="text" readOnly
                        value={
                          inf.proposedRate && inf.totalMonths
                            ? `$${(parseFloat(inf.proposedRate) * (parseInt(inf.totalMonths) || 1)).toLocaleString()}`
                            : ""
                        }
                        placeholder="—"
                        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy/60 bg-im8-sand/40 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add another — only shown in agency mode */}
              {isMulti && (
                <button
                  type="button"
                  onClick={addInfluencer}
                  className="w-full py-3 border-2 border-dashed border-im8-stone/40 rounded-xl text-sm font-medium text-im8-burgundy/60 hover:border-im8-red/40 hover:text-im8-red transition-colors"
                >
                  + Add another creator
                </button>
              )}
            </div>

            <hr className="border-im8-stone/30" />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors"
            >
              {loading
                ? "Submitting..."
                : isAdmin
                  ? influencers.length > 1
                    ? `Add ${influencers.length} creators to Discovery`
                    : "Add to Discovery"
                  : influencers.length > 1
                    ? `Submit ${influencers.length} creators`
                    : "Submit profile"}
            </button>
          </form>
        </div>

        {!isAdmin && (
          <p className="text-center text-im8-stone/60 text-xs mt-6">
            We review all submissions and respond within 5 business days. Questions?{" "}
            <a href="mailto:partners@im8health.com" className="underline">partners@im8health.com</a>
          </p>
        )}
      </div>
    </div>
  );
}
