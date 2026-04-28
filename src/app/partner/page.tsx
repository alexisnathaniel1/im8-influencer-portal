import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import NegotiationResponse from "./negotiation-response";
import ShippingPrompt, { type MissingCreator } from "@/components/partner/shipping-prompt";

// Partner-facing status labels — we deliberately don't expose internal triage
// states (reviewing, negotiation_needed, converted) to creators. Until a
// decision is finalised, every in-flight state reads as "Submitted". Once
// approved or rejected, that final outcome is shown. Negotiation terms are
// still surfaced via the dedicated counter-proposal block below.
function publicStatusLabel(realStatus: string): string {
  if (realStatus === "approved" || realStatus === "shortlisted") return "Approved";
  if (realStatus === "rejected") return "Rejected";
  return "Submitted";
}
function publicStatusColor(realStatus: string): string {
  if (realStatus === "approved" || realStatus === "shortlisted") return "bg-green-100 text-green-700";
  if (realStatus === "rejected") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}

// Mirrors the catalogue used in the admin Partner Tracker so the deliverables
// shown to creators match exactly what's stored on the deal.
const DELIVERABLE_LABELS: Record<string, string> = {
  IGR: "Instagram Reels", IGS: "Instagram Stories", TIKTOK: "TikTok Videos",
  YT_DEDICATED: "YouTube Dedicated Review", YT_INTEGRATED: "YouTube Integrated Review",
  YT_PODCAST: "YouTube Podcast Ad Read", UGC: "UGC Videos",
  NEWSLETTER: "Newsletter", APP_PARTNERSHIP: "App Partnership", BLOG: "Blog Post",
  WHITELIST: "Whitelisting", PAID_AD: "Paid Ad Usage Rights",
  RAW_FOOTAGE: "Raw Footage", LINK_BIO: "Link in Bio",
};
const BINARY_DELIVERABLE_CODES = new Set(["WHITELIST", "PAID_AD", "RAW_FOOTAGE", "LINK_BIO"]);

function formatDeliverables(items: Array<{ code: string; count: number }> | null | undefined): string {
  if (!items || items.length === 0) return "Standard package";
  const parts = items
    .map(item => {
      if (!item?.code) return null;
      if (BINARY_DELIVERABLE_CODES.has(item.code)) {
        return item.count > 0 ? DELIVERABLE_LABELS[item.code] ?? item.code : null;
      }
      if (item.count <= 0) return null;
      return `${item.count}× ${DELIVERABLE_LABELS[item.code] ?? item.code}`;
    })
    .filter((s): s is string => !!s);
  return parts.length ? parts.join(" · ") : "Standard package";
}

export default async function PartnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, partner_type, drive_folder_url")
    .eq("id", user.id)
    .single();

  // The user signed up with X, logs in with X, fills the intake form (which
  // pre-fills email = X), and submits. The submission therefore always has
  // their email on it. Use email as the source of truth: any discovery_profile
  // with submitter_email or influencer_email matching X belongs to this user
  // and should be linked to their user.id.
  const userEmail = (profile?.email ?? user.email ?? "").trim().toLowerCase();

  if (userEmail) {
    const [{ data: bySubmit }, { data: byInfl }] = await Promise.all([
      admin.from("discovery_profiles").select("id").ilike("submitter_email", userEmail),
      admin.from("discovery_profiles").select("id").ilike("influencer_email", userEmail),
    ]);
    const idsToLink = Array.from(
      new Set([...(bySubmit ?? []), ...(byInfl ?? [])].map(r => r.id))
    );
    if (idsToLink.length > 0) {
      await admin
        .from("discovery_profiles")
        .update({ submitted_by_profile_id: user.id })
        .in("id", idsToLink);
    }
  }

  // Fetch all deals where this user is the linked partner (both active + completed).
  // Shown as Contract 1, Contract 2, etc. so partners see their full history.
  // Use select("*") defensively — some columns (discount_code, affiliate_link) come
  // from later migrations; if those haven't been applied yet, an explicit column list
  // would make the whole query fail and the dashboard would silently show "No submissions".
  type LinkedDeal = {
    id: string;
    influencer_name: string;
    status: string;
    platform_primary: string;
    campaign_start: string | null;
    campaign_end: string | null;
    monthly_rate_cents: number | null;
    total_months: number | null;
    drive_folder_id: string | null;
    contract_sequence: number | null;
    previous_deal_id: string | null;
    discount_code: string | null;
    affiliate_link: string | null;
    payment_terms: string | null;
  };
  const { data: linkedDealsRaw, error: linkedDealsError } = await admin
    .from("deals")
    .select("*")
    .eq("influencer_profile_id", user.id)
    .not("status", "in", '("declined","rejected")')
    .order("contract_sequence", { ascending: true, nullsFirst: false });
  if (linkedDealsError) console.error("[partner/page] linkedDeals query failed:", linkedDealsError.message);
  let linkedDeals = (linkedDealsRaw ?? []) as unknown as LinkedDeal[];

  // Also fetch deals linked via discovery profiles this user submitted. This covers
  // the case where an admin manually added a creator to Discovery on behalf of an
  // agency — the deal's influencer_profile_id is set to the creator (not the agency),
  // so the agency wouldn't see it via the query above.
  {
    const { data: mySubmissions } = await admin
      .from("discovery_profiles")
      .select("id")
      .or(`submitted_by_profile_id.eq.${user.id}${userEmail ? `,submitter_email.ilike.${userEmail}` : ""}`);
    const submittedIds = (mySubmissions ?? []).map(s => s.id);
    if (submittedIds.length > 0) {
      const { data: moreDealsRaw } = await admin
        .from("deals")
        .select("*")
        .in("discovery_profile_id", submittedIds)
        .not("status", "in", '("declined","rejected")');
      const moreDeals = (moreDealsRaw ?? []) as unknown as LinkedDeal[];
      const existing = new Set(linkedDeals.map(d => d.id));
      for (const d of moreDeals) if (!existing.has(d.id)) linkedDeals.push(d);
      linkedDeals = linkedDeals.sort((a, b) =>
        (a.contract_sequence ?? 999) - (b.contract_sequence ?? 999)
      );
    }
  }

  // After the email-based linking step above, every submission that should
  // belong to this user has submitted_by_profile_id = user.id. One query is
  // all we need. select("*") keeps it resilient against schema drift.
  const { data: submissionsRaw, error: subsError } = await admin
    .from("discovery_profiles")
    .select("*")
    .eq("submitted_by_profile_id", user.id)
    .order("created_at", { ascending: false });

  if (subsError) {
    console.error("[partner/page] submissions query failed:", subsError.message, "uid:", user.id, "email:", userEmail);
  }

  const submissions = (submissionsRaw ?? []) as Array<{
    id: string;
    influencer_name: string;
    platform_primary: string;
    status: string;
    positioning: string | null;
    niche_tags: string[] | null;
    niche: string[] | null;
    proposed_rate_cents: number | null;
    proposed_deliverables: Array<{ code: string; count: number }> | null;
    total_months: number | null;
    negotiation_counter: string | null;
    agency_response: string | null;
    created_at: string;
  }>;

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

  const DEAL_STATUS_LABELS: Record<string, string> = {
    contacted: "In review", negotiating: "Negotiating", agreed: "Terms agreed",
    pending_approval: "Pending approval", approved: "Approved", contracted: "Contracted",
    live: "Live", completed: "Completed",
  };
  const DEAL_STATUS_COLORS: Record<string, string> = {
    contacted: "bg-gray-100 text-gray-600", negotiating: "bg-blue-100 text-blue-700",
    agreed: "bg-yellow-100 text-yellow-700", pending_approval: "bg-orange-100 text-orange-700",
    approved: "bg-green-100 text-green-700", contracted: "bg-emerald-100 text-emerald-700",
    live: "bg-emerald-100 text-emerald-700",
  };

  // ── Compute the "missing shipping address" list for the modal prompt ──────
  // Rules:
  //   - Only prompt for creators with an active deal (approved/contracted/live).
  //   - For individual creator: check the user's own profile-level addresses.
  //   - For agency: find all deals where the linked creator was submitted by
  //     this agency (via discovery_profiles.submitted_by_profile_id) and check
  //     each creator's addresses. Skip creators who haven't signed up yet
  //     (no influencer_profile_id on the deal) — those are handled by the
  //     admin side for now.
  const ACTIVE_STATUSES = ["approved", "contracted", "live"];

  // Start with the creators we need to check: for individuals, it's just user;
  // for agencies, it's the unique influencer_profile_ids across their submitted deals.
  type CandidateCreator = { profileId: string; name: string };
  const candidates = new Map<string, CandidateCreator>();

  // Individual creator path: if they themselves have any active deal, they're a candidate.
  if ((linkedDeals ?? []).some(d => ACTIVE_STATUSES.includes(d.status))) {
    candidates.set(user.id, {
      profileId: user.id,
      name: profile?.full_name ?? linkedDeals?.[0]?.influencer_name ?? "You",
    });
  }

  // Agency path: follow submitted_by_profile_id → discovery_profile_id → deals.
  if (profile?.partner_type === "agency" && submissionIds.length > 0) {
    const { data: agencyDeals } = await admin
      .from("deals")
      .select("id, status, influencer_profile_id, influencer_name")
      .in("discovery_profile_id", submissionIds)
      .in("status", ACTIVE_STATUSES);
    for (const d of agencyDeals ?? []) {
      if (d.influencer_profile_id && !candidates.has(d.influencer_profile_id)) {
        candidates.set(d.influencer_profile_id, {
          profileId: d.influencer_profile_id,
          name: d.influencer_name,
        });
      }
    }
  }

  // For each candidate, check if they have a profile-level primary shipping address
  // or a legacy JSON address on their profile.
  const missingCreators: MissingCreator[] = [];
  if (candidates.size > 0) {
    const candidateIds = Array.from(candidates.keys());
    const [{ data: rows }, { data: legacyProfiles }] = await Promise.all([
      admin
        .from("shipping_addresses")
        .select("profile_id")
        .in("profile_id", candidateIds)
        .is("deal_id", null),
      admin
        .from("profiles")
        .select("id, shipping_address_json")
        .in("id", candidateIds),
    ]);
    const haveNew = new Set((rows ?? []).map(r => r.profile_id));
    const haveLegacy = new Set(
      (legacyProfiles ?? [])
        .filter(p => {
          const json = p.shipping_address_json as Record<string, unknown> | null;
          return json && typeof json.address_line1 === "string" && json.address_line1.length > 0;
        })
        .map(p => p.id),
    );
    for (const c of candidates.values()) {
      if (!haveNew.has(c.profileId) && !haveLegacy.has(c.profileId)) {
        missingCreators.push(c);
      }
    }
  }

  return (
    <div className="space-y-6">
      {missingCreators.length > 0 && (
        <ShippingPrompt creators={missingCreators} />
      )}

      {/* Active partnership deals — shown when account is linked */}
      {linkedDeals && linkedDeals.length > 0 && (
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-im8-burgundy">Your collaborations with IM8</h1>
            <p className="text-im8-burgundy/60 mt-1">
              {linkedDeals.length === 1
                ? "Your partnership."
                : `${linkedDeals.length} contracts — oldest to newest.`}
            </p>
          </div>
          {linkedDeals.map(deal => (
            <div key={deal.id} className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-[6px] bg-im8-burgundy/10 text-im8-burgundy font-semibold whitespace-nowrap">
                      Contract {deal.contract_sequence ?? 1}
                    </span>
                    <span className="font-semibold text-im8-burgundy text-lg">{deal.influencer_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEAL_STATUS_COLORS[deal.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
                    </span>
                    <span className="text-xs text-im8-burgundy/50 capitalize">{deal.platform_primary}</span>
                    {deal.total_months && (
                      <span className="text-xs text-im8-burgundy/50">· {deal.total_months} month{deal.total_months === 1 ? "" : "s"}</span>
                    )}
                  </div>
                  {(deal.campaign_start || deal.campaign_end) && (
                    <p className="text-sm text-im8-burgundy/60 mt-1">
                      {deal.campaign_start && new Date(deal.campaign_start).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      {deal.campaign_start && deal.campaign_end && " → "}
                      {deal.campaign_end && new Date(deal.campaign_end).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
              {/* Discount code + affiliate link — shown when set */}
              {(deal.discount_code || deal.affiliate_link) && (
                <div className="flex flex-wrap gap-4 px-4 py-3 bg-im8-sand/50 rounded-xl border border-im8-stone/20 text-sm">
                  {deal.discount_code && (
                    <div>
                      <p className="text-xs text-im8-burgundy/50 uppercase tracking-wide font-medium mb-0.5">Your discount code</p>
                      <p className="font-mono font-bold text-im8-burgundy text-base tracking-wider">{deal.discount_code}</p>
                    </div>
                  )}
                  {deal.affiliate_link && (
                    <div>
                      <p className="text-xs text-im8-burgundy/50 uppercase tracking-wide font-medium mb-0.5">Your tracking link</p>
                      <a href={deal.affiliate_link} target="_blank" rel="noopener noreferrer"
                        className="text-im8-red hover:underline text-sm break-all">{deal.affiliate_link}</a>
                    </div>
                  )}
                </div>
              )}
              {["approved", "contracted", "live"].includes(deal.status) ? (
                <div className="flex flex-wrap gap-3">
                  <Link href="/partner/briefs" className="text-sm px-4 py-2 bg-im8-burgundy text-white rounded-lg hover:bg-im8-red transition-colors">
                    View briefs
                  </Link>
                  <Link href={`/partner/submit?dealId=${deal.id}`} className="text-sm px-4 py-2 border border-im8-stone/40 text-im8-burgundy rounded-lg hover:bg-im8-sand transition-colors">
                    Upload content
                  </Link>
                  <Link href="/partner/submissions" className="text-sm px-4 py-2 border border-im8-stone/40 text-im8-burgundy rounded-lg hover:bg-im8-sand transition-colors">
                    My submissions
                  </Link>
                  <Link href="/partner/edited-videos" className="text-sm px-4 py-2 border border-im8-stone/40 text-im8-burgundy rounded-lg hover:bg-im8-sand transition-colors">
                    Edited videos
                  </Link>
                  {deal.drive_folder_id && (
                    <a
                      href={`https://drive.google.com/drive/folders/${deal.drive_folder_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm px-4 py-2 border border-im8-stone/40 text-im8-burgundy rounded-lg hover:bg-im8-sand transition-colors"
                    >
                      📁 Drive folder
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-im8-burgundy/50 italic">
                  {deal.status === "pending_approval"
                    ? "Your proposal is being reviewed by the IM8 team. We'll be in touch soon."
                    : deal.status === "contacted" || deal.status === "negotiating"
                    ? "Terms are being finalised — we'll reach out when ready."
                    : deal.status === "agreed"
                    ? "Terms agreed — contract being prepared."
                    : "Your collaboration is complete. Thank you for partnering with IM8!"}
                </p>
              )}
            </div>
          ))}
          <hr className="border-im8-stone/20" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-im8-burgundy">
            {linkedDeals && linkedDeals.length > 0 ? "Submitted profiles" : "Your submissions"}
          </h1>
          <p className="text-im8-burgundy/60 mt-1">
            {profile?.partner_type === "agency"
              ? "Creators you've submitted to IM8."
              : "The profile you've submitted to IM8."}
          </p>
        </div>
        {/* Agencies can submit unlimited creators. Individual creators get one
            profile per account — only show the CTA if they haven't submitted yet. */}
        {(profile?.partner_type === "agency" || submissions.length === 0) && (
          <Link href="/intake"
            className="px-4 py-2 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors">
            + {profile?.partner_type === "agency" ? "Submit creators" : "Submit profile"}
          </Link>
        )}
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
              <div key={s.id} className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-im8-burgundy">{s.influencer_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${publicStatusColor(s.status)}`}>
                        {publicStatusLabel(s.status)}
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

                {/* Current terms — proposed_deliverables reflects whatever
                    is on the record right now (post-counter if applicable),
                    matching what shows on the Partner Tracker overview. */}
                {(() => {
                  const months = s.total_months ?? 3;
                  const monthlyUsd = s.proposed_rate_cents ? s.proposed_rate_cents / 100 : null;
                  const totalUsd = monthlyUsd !== null ? monthlyUsd * months : null;
                  const deliverablesText = formatDeliverables(s.proposed_deliverables);
                  return (
                    <div className="bg-im8-sand/50 rounded-lg p-4 space-y-2 text-sm border border-im8-stone/20">
                      <p className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">
                        {isNegotiating ? "Current proposal" : "Submitted terms"}
                      </p>
                      <div className="flex gap-6 flex-wrap">
                        {monthlyUsd !== null ? (
                          <div>
                            <span className="text-im8-burgundy/50 text-xs">Monthly rate</span>
                            <p className="font-semibold text-im8-burgundy">${monthlyUsd.toFixed(0)}/mo</p>
                            {totalUsd !== null && (
                              <p className="text-xs text-im8-burgundy/50">${totalUsd.toFixed(0)} over {months} month{months === 1 ? "" : "s"}</p>
                            )}
                          </div>
                        ) : null}
                        <div className="flex-1">
                          <span className="text-im8-burgundy/50 text-xs">Deliverables</span>
                          <p className="text-im8-burgundy/80 text-xs mt-0.5">{deliverablesText}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Negotiation counter from IM8 — note + accept/decline. The
                    actual rate/deliverables now live in the Current proposal
                    block above so this section only carries the message and
                    the response control. */}
                {isNegotiating && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">IM8 counter-proposal</p>
                    {s.negotiation_counter && (
                      <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{s.negotiation_counter}</p>
                    )}
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
