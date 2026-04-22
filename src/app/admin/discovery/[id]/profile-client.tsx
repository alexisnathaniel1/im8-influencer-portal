"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Profile = Record<string, unknown>;

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  reviewing: "bg-yellow-100 text-yellow-700",
  shortlisted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

const STATUSES = ["new", "reviewing", "shortlisted", "rejected", "converted"];

export default function DiscoveryProfileClient({
  profile,
  existingDealId,
}: {
  profile: Profile;
  existingDealId: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(profile.status as string);
  const [notes, setNotes] = useState((profile.notes as string) ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function changeStatus(newStatus: string) {
    setUpdatingStatus(true);
    await fetch(`/api/discovery/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatus(newStatus);
    setUpdatingStatus(false);
    router.refresh();
  }

  async function saveNotes() {
    setSavingNotes(true);
    await fetch(`/api/discovery/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSavingNotes(false);
    setSavedNotes(true);
    setTimeout(() => setSavedNotes(false), 2500);
  }

  const aiScore = profile.ai_score as number | null;
  const scoreColor = aiScore === null ? "" : aiScore >= 70 ? "text-green-600" : aiScore >= 40 ? "text-yellow-600" : "text-red-600";
  const redFlags = (profile.ai_red_flags as string[]) ?? [];
  const nicheTags = (profile.niche_tags as string[]) ?? (profile.niche as string[]) ?? [];
  const portfolioUrl = (profile.portfolio_url as string) ?? null;
  const agencyName = (profile.agency_name as string) ?? (profile.submitter_agency as string) ?? null;

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="bg-white rounded-xl border border-im8-stone/30 p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-sm px-3 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[status] ?? ""}`}>
            {status}
          </span>
          <span className="text-sm text-im8-burgundy/50 capitalize">{profile.platform_primary as string}</span>
          {aiScore !== null && (
            <span className={`text-sm font-bold ${scoreColor}`}>AI score: {aiScore}/100</span>
          )}
          {redFlags.length > 0 && (
            <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full">
              {redFlags.length} flag{redFlags.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {STATUSES.filter(s => s !== status).map(s => (
            <button key={s} onClick={() => changeStatus(s)} disabled={updatingStatus}
              className="text-xs px-3 py-1.5 border border-im8-stone/40 text-im8-burgundy/60 rounded-lg hover:bg-im8-sand transition-colors disabled:opacity-40 capitalize">
              → {s}
            </button>
          ))}
          {status === "shortlisted" && !existingDealId && (
            <Link href={`/admin/deals/new?profileId=${profile.id as string}`}
              className="text-xs px-3 py-1.5 bg-im8-red text-white rounded-lg hover:bg-im8-burgundy transition-colors font-medium">
              Create deal →
            </Link>
          )}
          {existingDealId && (
            <Link href={`/admin/deals/${existingDealId}`}
              className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium">
              View deal →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left: influencer details */}
        <div className="col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-4">
            <h2 className="font-semibold text-im8-burgundy">Influencer details</h2>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="Name" value={profile.influencer_name as string} />
              <Row label="Platform" value={(profile.platform_primary as string)} className="capitalize" />
              {(profile.instagram_handle as string) && (
                <Row label="Instagram" value={`@${profile.instagram_handle}`}
                  href={`https://instagram.com/${(profile.instagram_handle as string).replace(/^@/, "")}`} />
              )}
              {(profile.tiktok_handle as string) && (
                <Row label="TikTok" value={`@${profile.tiktok_handle}`}
                  href={`https://tiktok.com/@${(profile.tiktok_handle as string).replace(/^@/, "")}`} />
              )}
              {(profile.youtube_handle as string) && (
                <Row label="YouTube" value={`@${profile.youtube_handle}`} />
              )}
              {profile.follower_count ? (
                <Row label="Followers" value={Number(profile.follower_count).toLocaleString()} />
              ) : null}
              {profile.proposed_rate_cents ? (
                <Row label="Proposed rate" value={`$${(Number(profile.proposed_rate_cents) / 100).toFixed(0)}/mo`} />
              ) : null}
              {portfolioUrl && (
                <Row label="Portfolio" value="Open link ↗" href={portfolioUrl} />
              )}
            </div>

            {nicheTags.length > 0 && (
              <div>
                <p className="text-xs font-medium text-im8-burgundy/50 uppercase tracking-wide mb-2">Niche</p>
                <div className="flex flex-wrap gap-1.5">
                  {nicheTags.map((n: string) => (
                    <span key={n} className="text-xs bg-im8-sand text-im8-burgundy px-2.5 py-1 rounded-full">{n}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI assessment */}
          {(profile.ai_summary || redFlags.length > 0) && (
            <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-im8-burgundy">AI assessment</h2>
                {aiScore !== null && (
                  <span className={`text-lg font-bold ${scoreColor}`}>{aiScore}/100</span>
                )}
              </div>
              {profile.ai_summary && (
                <p className="text-sm text-im8-burgundy/70 leading-relaxed">{profile.ai_summary as string}</p>
              )}
              {redFlags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Red flags</p>
                  <ul className="space-y-1">
                    {redFlags.map((f: string, i: number) => (
                      <li key={i} className="text-xs text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Reviewer notes */}
          <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-3">
            <h2 className="font-semibold text-im8-burgundy">Internal notes</h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              placeholder="Add notes about this influencer — visible only to the team..."
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 resize-none" />
            <div className="flex justify-end">
              <button onClick={saveNotes} disabled={savingNotes}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 ${savedNotes ? "bg-green-600" : "bg-im8-red hover:bg-im8-burgundy"}`}>
                {savingNotes ? "Saving..." : savedNotes ? "Saved ✓" : "Save notes"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: submitter info */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-3">
            <h2 className="font-semibold text-im8-burgundy text-sm">Submitted by</h2>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-im8-burgundy">{profile.submitter_name as string}</p>
              <a href={`mailto:${profile.submitter_email as string}`}
                className="text-im8-red hover:underline block text-xs break-all">
                {profile.submitter_email as string}
              </a>
              {agencyName && (
                <p className="text-xs text-im8-burgundy/60">{agencyName}</p>
              )}
              <p className="text-xs text-im8-burgundy/40">
                {new Date(profile.created_at as string).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          {(profile.notes as string) && !notes && (
            <div className="bg-im8-sand/50 rounded-xl border border-im8-stone/20 p-5 space-y-2">
              <h2 className="font-semibold text-im8-burgundy text-sm">Pitch notes</h2>
              <p className="text-xs text-im8-burgundy/70 leading-relaxed whitespace-pre-wrap">{profile.notes as string}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, href, className = "" }: {
  label: string; value: string; href?: string; className?: string;
}) {
  return (
    <>
      <div className="text-xs font-medium text-im8-burgundy/50 uppercase tracking-wide self-center">{label}</div>
      <div className={`text-sm text-im8-burgundy ${className}`}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-im8-red hover:underline">{value}</a>
        ) : value}
      </div>
    </>
  );
}
