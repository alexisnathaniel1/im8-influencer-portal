import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  revision_requested: "bg-amber-100 text-amber-700",
};

export default async function PartnerBriefsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: deals } = await supabase
    .from("deals")
    .select("id")
    .eq("influencer_profile_id", user.id);

  const dealIds = (deals ?? []).map((d) => d.id);

  const { data: briefs } = dealIds.length > 0
    ? await supabase
        .from("briefs")
        .select("id, title, platform, deliverable_type, due_date, status, google_doc_url, created_at, deal:deal_id(influencer_name)")
        .in("deal_id", dealIds)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">My Briefs</h1>
        <p className="text-im8-burgundy/60 mt-1">Content briefs from IM8</p>
      </div>

      {(!briefs || briefs.length === 0) ? (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No briefs yet — your team will send them here once your deal is finalised.
        </div>
      ) : (
        <div className="space-y-3">
          {briefs.map((brief) => {
            const deal = brief.deal as unknown as { influencer_name: string } | null;
            const googleDocUrl = (brief as Record<string, unknown>).google_doc_url as string | null;
            return (
              <div key={brief.id} className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-im8-burgundy">{brief.title}</p>
                    {deal && <p className="text-sm text-im8-burgundy/60 mt-0.5">{deal.influencer_name}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {brief.platform && <span className="text-xs text-im8-burgundy/50 capitalize">{brief.platform}</span>}
                      {brief.deliverable_type && <span className="text-xs text-im8-burgundy/50">{brief.deliverable_type}</span>}
                      {brief.due_date && (
                        <span className="text-xs text-im8-burgundy/50">Due {new Date(brief.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[brief.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {brief.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {googleDocUrl ? (
                    <a
                      href={googleDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-im8-red text-white text-sm font-medium rounded-lg hover:bg-im8-burgundy transition-colors"
                    >
                      Open brief →
                    </a>
                  ) : (
                    <span className="text-xs text-im8-burgundy/40 italic">Brief document coming soon</span>
                  )}
                  <Link href={`/partner/briefs/${brief.id}`} className="text-sm text-im8-burgundy/50 hover:text-im8-red">
                    Details & submissions
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
