import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import NegotiationResponse from "./negotiation-response";

const STATUS_LABELS: Record<string, string> = {
  new: "Submitted",
  submitted: "Submitted",
  reviewing: "Under review",
  negotiation_needed: "Negotiation needed",
  approved: "Approved",
  shortlisted: "Shortlisted",
  rejected: "Not a fit",
  converted: "Moving forward",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  submitted: "bg-blue-100 text-blue-700",
  reviewing: "bg-yellow-100 text-yellow-700",
  negotiation_needed: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  shortlisted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

const STANDARD_DELIVERABLES = "3 IG Reels · 3 IG Stories · Raw footage · Whitelisting · Paid ad usage rights · Link in bio · 3 UGC Videos for ads — across 3 months";

export default async function PartnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, partner_type")
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email ?? "";

  const { data: submissions } = await admin
    .from("discovery_profiles")
    .select("id, influencer_name, platform_primary, status, positioning, niche_tags, niche, proposed_rate_cents, proposed_deliverables, negotiation_counter, agency_response, created_at")
    .or(`submitted_by_profile_id.eq.${user.id},submitter_email.eq.${email}`)
    .order("created_at", { ascending: false });

  const submissionIds = (submissions ?? []).map(s => s.id);

  const latestCommentBySubmission = new Map<string, { body: string; created_at: string; kind: string }>();
  if (submissionIds.length > 0) {
    const { data: visibleComments } = await admin
      .from("discovery_comments")
      .select("discovery_profile_id, body, created_at, kind")
      .in("discovery_profile_id", submissionIds)
      .eq("visible_to_partner", true)
      .order("created_at", { ascending: false });
    (visibleComments ?? []).forEach(c => {
      if (!latestCommentBySubmission.has(c.discovery_profile_id)) {
        latestCommentBySubmission.set(c.discovery_profile_id, { body: c.body, created_at: c.created_at, kind: c.kind });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-im8-burgundy">Your submissions</h1>
          <p className="text-im8-burgundy/60 mt-1">
            {profile?.partner_type === "agency"
              ? "Creators you've submitted to IM8."
              : "The profile you've submitted to IM8."}
          </p>
        </div>
        <Link href="/intake"
          className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors">
          + {profile?.partner_type === "agency" ? "Submit creators" : "Submit profile"}
        </Link>
      </div>

      {(!submissions || submissions.length === 0) ? (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center">
          <p className="text-im8-burgundy/60 mb-4">No submissions yet.</p>
          <Link href="/intake"
            className="inline-block px-5 py-2.5 bg-im8-red text-white text-sm font-medium rounded-lg hover:bg-im8-burgundy transition-colors">
            Fill the intake form →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map(s => {
            const latest = latestCommentBySubmission.get(s.id);
            const isNegotiating = s.status === "negotiation_needed";
            const niches = (s.niche_tags ?? s.niche ?? []) as string[];

            return (
              <div key={s.id} className={`bg-white rounded-xl border p-5 space-y-4 ${isNegotiating ? "border-orange-300" : "border-im8-stone/30"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-im8-burgundy">{s.influencer_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? ""}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                      <span className="text-xs text-im8-burgundy/50 capitalize">{s.platform_primary}</span>
                    </div>
                    {s.positioning && (
                      <p className="text-sm text-im8-burgundy/70 mt-1 italic">&ldquo;{s.positioning}&rdquo;</p>
                    )}
                    {niches.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {niches.map((n: string) => (
                          <span key={n} className="text-xs bg-im8-sand text-im8-burgundy px-2 py-0.5 rounded-full">{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-im8-burgundy/40 shrink-0">
                    {new Date(s.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>

                {/* Submitted terms */}
                <div className="bg-im8-sand/50 rounded-lg p-4 space-y-2 text-sm border border-im8-stone/20">
                  <p className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">Submitted terms</p>
                  <div className="flex gap-6 flex-wrap">
                    {s.proposed_rate_cents ? (
                      <div>
                        <span className="text-im8-burgundy/50 text-xs">Monthly rate</span>
                        <p className="font-semibold text-im8-burgundy">${(s.proposed_rate_cents / 100).toFixed(0)}/mo</p>
                        <p className="text-xs text-im8-burgundy/50">${((s.proposed_rate_cents / 100) * 3).toFixed(0)} over 3 months</p>
                      </div>
                    ) : null}
                    <div className="flex-1">
                      <span className="text-im8-burgundy/50 text-xs">Deliverables</span>
                      <p className="text-im8-burgundy/80 text-xs mt-0.5">{STANDARD_DELIVERABLES}</p>
                    </div>
                  </div>
                </div>

                {/* Negotiation counter from IM8 */}
                {isNegotiating && s.negotiation_counter && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">IM8 counter-proposal</p>
                    <p className="text-sm text-orange-900 whitespace-pre-wrap leading-relaxed">{s.negotiation_counter}</p>
                    {s.agency_response ? (
                      <div className={`text-sm font-medium px-3 py-2 rounded-lg ${s.agency_response === "accepted" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        You {s.agency_response === "accepted" ? "accepted" : "declined"} this proposal.
                      </div>
                    ) : (
                      <NegotiationResponse profileId={s.id} />
                    )}
                  </div>
                )}

                {/* Latest admin comment (non-negotiation) */}
                {latest && !isNegotiating && (
                  <div className="bg-im8-sand/50 rounded-lg p-3 border border-im8-stone/30">
                    <div className="text-xs text-im8-burgundy/50 mb-1">
                      Latest note from IM8 · {new Date(latest.created_at).toLocaleDateString()}
                    </div>
                    <p className="text-sm text-im8-burgundy whitespace-pre-wrap line-clamp-3">{latest.body}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
