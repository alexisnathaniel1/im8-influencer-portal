import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  revision_requested: "bg-amber-100 text-amber-700",
  pending: "bg-gray-100 text-gray-600",
};

export default async function InfluencerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  const [{ data: profile }, { data: deals }, { data: submissions }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).single(),
    admin.from("deals").select("id, influencer_name, status, monthly_rate_cents, total_rate_cents, platform_primary").eq("influencer_profile_id", id),
    admin.from("submissions").select("id, file_name, status, submitted_at, brief:brief_id(title)").eq("influencer_id", id).order("submitted_at", { ascending: false }),
  ]);

  if (!profile) redirect("/admin/influencers");

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/admin/influencers" className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Influencers</Link>
          <h1 className="text-2xl font-bold text-im8-burgundy">{profile.full_name || profile.email}</h1>
          <p className="text-sm text-im8-burgundy/60">{profile.email}</p>
        </div>

        {deals && deals.length > 0 && (
          <div className="bg-white rounded-xl border border-im8-stone/20 p-6 mb-6">
            <h2 className="text-base font-semibold text-im8-burgundy mb-4">Deals</h2>
            <div className="space-y-3">
              {deals.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between">
                  <div>
                    <Link href={`/admin/deals/${deal.id}`} className="text-sm font-medium text-im8-burgundy hover:underline">{deal.influencer_name}</Link>
                    <p className="text-xs text-im8-burgundy/50 capitalize">{deal.platform_primary}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {deal.total_rate_cents && (
                      <span className="text-sm text-im8-burgundy/70">${(deal.total_rate_cents / 100).toFixed(0)}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[deal.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {deal.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-im8-stone/20 p-6">
          <h2 className="text-base font-semibold text-im8-burgundy mb-4">Submissions</h2>
          {submissions && submissions.length > 0 ? (
            <div className="space-y-2">
              {submissions.map((sub) => {
                const brief = sub.brief as unknown as { title: string } | null;
                return (
                  <div key={sub.id} className="flex items-center justify-between py-2 border-b border-im8-sand/50 last:border-0">
                    <div>
                      <p className="text-sm text-im8-burgundy">{sub.file_name || "Untitled"}</p>
                      {brief && <p className="text-xs text-im8-burgundy/50">{brief.title}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-im8-burgundy/40">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[sub.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {sub.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-im8-burgundy/50">No submissions yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
