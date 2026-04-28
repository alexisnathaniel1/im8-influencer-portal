import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import NegotiationResponse from "./negotiation-response";
import ShippingPrompt, { type MissingCreator } from "@/components/partner/shipping-prompt";

const STATUS_LABELS: Record<string, string> = {
  new: "Submitted",
  submitted: "Submitted",
  reviewing: "Under Review",
  negotiation_needed: "Negotiation Needed",
  approved: "Approved",
  shortlisted: "Approved",
  rejected: "Rejected",
  converted: "Pending MGMT Approval",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  submitted: "bg-blue-100 text-blue-700",
  reviewing: "bg-yellow-100 text-yellow-700",
  negotiation_needed: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  shortlisted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-im8-burgundy/10 text-im8-burgundy",
};

const STANDARD_DELIVERABLES = "3 IG Reels · 3 IG Stories · Raw footage · Whitelisting · Paid ad usage rights · Link in bio · 3 UGC Videos for ads — across 3 months";

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

  // Use both profile.email and the auth user's email — they sometimes differ
  // (profile.email is set on signup; user.email is what they auth with) and we
  // need to match either against discovery_profiles.submitter_email.
  const emailCandidates = Array.from(
    new Set(
      [profile?.email, user.email]
        .filter((e): e is string => typeof e === "string" && e.length > 0)
        .map(e => e.trim().toLowerCase()),
    ),
  );
  const email = emailCandidates[0] ?? "";

  // ── Self-heal: claim any orphan discovery_profiles that match this user's
  // emails and weren't yet linked to their profile id. This catches the case
  // where the row was created before signup, before ensure-profile last ran,
  // or where the email changed casing between submit and signup.
  if (emailCandidates.length > 0) {
    const orphanIds = new Set<string>();
    for (const e of emailCandidates) {
      const [{ data: bySubmit }, { data: byInfl }] = await Promise.all([
        admin.from("discovery_profiles").select("id, submitted_by_profile_id").ilike("submitter_email", e),
        admin.from("discovery_profiles").select("id, submitted_by_profile_id").ilike("influencer_email", e),
      ]);
      for (const r of [...(bySubmit ?? []), ...(byInfl ?? [])]) {
        if (r.submitted_by_profile_id !== user.id) orphanIds.add(r.id);
      }
    }
    if (orphanIds.size > 0) {
      await admin
        .from("discovery_profiles")
        .update({ submitted_by_profile_id: user.id })
        .in("id", Array.from(orphanIds));
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
      .or(`submitted_by_profile_id.eq.${user.id}${email ? `,submitter_email.ilike.${email}` : ""}`);
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

  // Three separate queries to avoid PostgREST escaping issues with email in .or()
  // byProfileId: submissions the user filed themselves (agency or creator)
  // byEmail: submissions filed by their email address (self-submissions before account creation)
  // byInfluencerEmail: submissions where this user IS the creator, even if an admin/agency submitted
  // Use a minimal safe SELECT to avoid failures if optional columns (e.g. influencer_email,
  // proposed_deliverables) haven't been migrated in this environment yet.
  const SELECT_FIELDS = "id, influencer_name, platform_primary, status, positioning, niche_tags, niche, proposed_rate_cents, proposed_deliverables, negotiation_counter, agency_response, created_at";

  const emptyResult = { data: [] as { id: string; [k: string]: unknown }[], error: null };

  // Run byEmail / byInfluencerEmail against EACH email candidate to catch the
  // case where profile.email and auth user.email differ. Wrap the email in
  // wildcards so trailing whitespace or stray characters in the DB still match.
  const byEmailQueries = emailCandidates.flatMap(e => {
    const wildcard = `%${e}%`;
    return [
      admin.from("discovery_profiles").select(SELECT_FIELDS).ilike("submitter_email", wildcard).order("created_at", { ascending: false }),
      admin.from("discovery_profiles").select(SELECT_FIELDS).ilike("influencer_email", wildcard).order("created_at", { ascending: false }),
    ];
  });

  // Name-based fallback — only useful when full_name is meaningfully unique.
  const fullName = (profile?.full_name ?? "").trim();
  const nameQueries = fullName.length >= 4
    ? [
        admin.from("discovery_profiles").select(SELECT_FIELDS).ilike("influencer_name", `%${fullName}%`).order("created_at", { ascending: false }),
        admin.from("discovery_profiles").select(SELECT_FIELDS).ilike("submitter_name", `%${fullName}%`).order("created_at", { ascending: false }),
      ]
    : [];

  const [byProfileIdRes, ...allResults] = await Promise.all([
    admin
      .from("discovery_profiles")
      .select(SELECT_FIELDS)
      .eq("submitted_by_profile_id", user.id)
      .order("created_at", { ascending: false }),
    ...byEmailQueries,
    ...nameQueries,
  ]);
  const { data: byProfileId, error: e1 } = byProfileIdRes;
  const emailResults = allResults.slice(0, byEmailQueries.length);
  const nameResults = allResults.slice(byEmailQueries.length);
  const byEmail = emailResults.flatMap(r => r.data ?? []);
  const byName = nameResults.flatMap(r => r.data ?? []);
  const byInfluencerEmail: typeof byEmail = []; // merged into byEmail above
  const e2 = emailResults.find(r => r.error)?.error ?? null;

  if (e1) console.error("[partner/page] byProfileId failed:", e1.message, "uid:", user.id);
  if (e2) console.error("[partner/page] email match failed:", e2.message, "candidates:", emailCandidates);

  // Diagnostic — visible in Vercel function logs to debug missing submissions.
  console.log("[partner/page] match summary", {
    user_id: user.id,
    auth_email: user.email,
    profile_email: profile?.email,
    full_name: fullName,
    email_candidates: emailCandidates,
    by_profile_id: (byProfileId ?? []).length,
    by_email: byEmail.length,
    by_name: byName.length,
  });

  // Merge and deduplicate by id
  const seen = new Set<string>();
  const submissions = [
    ...(byProfileId ?? []),
    ...(byEmail ?? []),
    ...(byInfluencerEmail ?? []),
    ...(byName ?? []),
  ].filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

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
