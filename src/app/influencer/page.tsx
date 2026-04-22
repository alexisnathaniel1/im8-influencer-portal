import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function InfluencerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, drive_folder_url")
    .eq("id", user!.id)
    .single();

  const { data: deals } = await supabase
    .from("deals")
    .select("id, status, platform_primary")
    .eq("influencer_profile_id", user!.id)
    .in("status", ["approved", "contracted", "live"]);

  const dealIds = deals?.map(d => d.id) ?? [];

  const [
    { data: pendingBriefs },
    { count: pendingReview },
    { count: approved },
  ] = await Promise.all([
    supabase.from("briefs").select("id, title, due_date, deal_id").in("deal_id", dealIds).neq("status", "draft").order("due_date"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("influencer_id", user!.id).eq("status", "pending"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("influencer_id", user!.id).eq("status", "approved"),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">Welcome, {profile?.full_name?.split(" ")[0] ?? "Creator"}</h1>
        <p className="text-im8-burgundy/60 mt-1">Your IM8 content dashboard</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active briefs", value: pendingBriefs?.length ?? 0, href: "/influencer/briefs", color: "bg-im8-sand" },
          { label: "Pending review", value: pendingReview ?? 0, href: "/influencer/submissions", color: "bg-yellow-50" },
          { label: "Approved pieces", value: approved ?? 0, href: "/influencer/submissions?status=approved", color: "bg-green-50" },
        ].map(s => (
          <Link key={s.label} href={s.href}
            className={`${s.color} rounded-xl p-5 border border-im8-stone/30 hover:shadow-md transition-shadow`}>
            <div className="text-3xl font-bold text-im8-burgundy">{s.value}</div>
            <div className="text-sm text-im8-burgundy/60 mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      {pendingBriefs && pendingBriefs.length > 0 && (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-4">
          <h2 className="font-semibold text-im8-burgundy">Your briefs</h2>
          {pendingBriefs.map(b => (
            <Link key={b.id} href={`/influencer/briefs/${b.id}`}
              className="flex items-center justify-between p-4 bg-im8-sand/40 rounded-lg hover:bg-im8-sand transition-colors">
              <div>
                <div className="font-medium text-im8-burgundy text-sm">{b.title}</div>
                {b.due_date && (
                  <div className="text-xs text-im8-burgundy/50 mt-0.5">
                    Due {new Date(b.due_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              <span className="text-im8-red text-sm">View brief →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Link href="/influencer/submit"
          className="bg-im8-red text-white rounded-xl p-6 hover:bg-im8-burgundy transition-colors text-center">
          <div className="text-2xl mb-2">⬆️</div>
          <div className="font-semibold">Submit content</div>
          <div className="text-sm text-white/70 mt-1">Upload your video drafts</div>
        </Link>
        {profile?.drive_folder_url && (
          <a href={profile.drive_folder_url} target="_blank" rel="noopener noreferrer"
            className="bg-white border border-im8-stone/30 rounded-xl p-6 hover:shadow-md transition-shadow text-center">
            <div className="text-2xl mb-2">📁</div>
            <div className="font-semibold text-im8-burgundy">Open Drive folder</div>
            <div className="text-sm text-im8-burgundy/50 mt-1">Upload directly to Google Drive</div>
          </a>
        )}
      </div>
    </div>
  );
}
