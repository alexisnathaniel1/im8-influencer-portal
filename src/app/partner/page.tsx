import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  new: "Submitted",
  submitted: "Submitted",
  reviewing: "Reviewed",
  negotiation_needed: "Negotiation needed",
  approved: "Approved",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
  converted: "Moved to approvals",
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
    .select("id, influencer_name, platform_primary, status, positioning, niche_tags, created_at")
    .or(`submitted_by_profile_id.eq.${user.id},submitter_email.eq.${email}`)
    .order("created_at", { ascending: false });

  const submissionIds = (submissions ?? []).map(s => s.id);

  const latestCommentBySubmission = new Map<string, { body: string; created_at: string }>();
  if (submissionIds.length > 0) {
    const { data: visibleComments } = await admin
      .from("discovery_comments")
      .select("discovery_profile_id, body, created_at")
      .in("discovery_profile_id", submissionIds)
      .eq("visible_to_partner", true)
      .order("created_at", { ascending: false });
    (visibleComments ?? []).forEach(c => {
      if (!latestCommentBySubmission.has(c.discovery_profile_id)) {
        latestCommentBySubmission.set(c.discovery_profile_id, { body: c.body, created_at: c.created_at });
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
          <p className="text-im8-burgundy/60 mb-4">
            No submissions yet.
          </p>
          <Link href="/intake"
            className="inline-block px-5 py-2.5 bg-im8-red text-white text-sm font-medium rounded-lg hover:bg-im8-burgundy transition-colors">
            Fill the intake form →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(s => {
            const latest = latestCommentBySubmission.get(s.id);
            return (
              <div key={s.id} className="bg-white rounded-xl border border-im8-stone/30 p-5">
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
                    {(s.niche_tags ?? []).length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(s.niche_tags ?? []).map((n: string) => (
                          <span key={n} className="text-xs bg-im8-sand text-im8-burgundy px-2 py-0.5 rounded-full">{n}</span>
                        ))}
                      </div>
                    )}
                    {latest && (
                      <div className="mt-3 bg-im8-sand/50 rounded-lg p-3 border border-im8-stone/30">
                        <div className="text-xs text-im8-burgundy/50 mb-1">
                          Latest note from IM8 · {new Date(latest.created_at).toLocaleDateString()}
                        </div>
                        <p className="text-sm text-im8-burgundy whitespace-pre-wrap line-clamp-3">{latest.body}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-im8-burgundy/40 shrink-0">
                    {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
