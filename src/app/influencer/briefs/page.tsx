import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  revision_requested: "bg-amber-100 text-amber-700",
};

export default async function InfluencerBriefsPage() {
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
        .select("id, title, platform, deliverable_type, due_date, status, created_at, deal:deal_id(influencer_name)")
        .in("deal_id", dealIds)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-im8-burgundy mb-6">My Briefs</h1>

        {(!briefs || briefs.length === 0) ? (
          <div className="bg-white rounded-xl border border-im8-stone/20 p-8 text-center">
            <p className="text-im8-burgundy/60">No briefs yet — your team will send them here once your deal is finalised.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {briefs.map((brief) => {
              const deal = brief.deal as unknown as { influencer_name: string } | null;
              return (
                <Link
                  key={brief.id}
                  href={`/influencer/briefs/${brief.id}`}
                  className="block bg-white rounded-xl border border-im8-stone/20 p-5 hover:border-im8-red/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-im8-burgundy">{brief.title}</p>
                      {deal && <p className="text-sm text-im8-burgundy/60 mt-0.5">{deal.influencer_name}</p>}
                      <div className="flex items-center gap-3 mt-2">
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
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
