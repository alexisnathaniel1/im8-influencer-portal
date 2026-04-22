import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function InfluencerBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: brief } = await supabase
    .from("briefs")
    .select("*, deal:deal_id(id, influencer_name, platform_primary)")
    .eq("id", id)
    .single();

  if (!brief || brief.status === "draft") redirect("/influencer/briefs");

  const deal = brief.deal as unknown as { id: string; influencer_name: string; platform_primary: string } | null;

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, file_name, status, submitted_at, feedback")
    .eq("brief_id", id)
    .eq("influencer_id", user.id)
    .order("submitted_at", { ascending: false });

  const hasPending = (submissions ?? []).some((s) => s.status === "pending");

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link href="/influencer/briefs" className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; My Briefs</Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-im8-burgundy">{brief.title}</h1>
              {deal && <p className="text-sm text-im8-burgundy/60">{deal.influencer_name} · {deal.platform_primary}</p>}
            </div>
            {deal && !hasPending && (
              <Link
                href={`/influencer/submit?briefId=${brief.id}&dealId=${deal.id}`}
                className="flex-shrink-0 inline-flex items-center px-4 py-2 bg-im8-red text-white text-sm font-medium rounded-lg hover:bg-im8-burgundy transition-colors"
              >
                Upload Draft
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-im8-stone/20 p-6 mb-6">
          {brief.due_date && (
            <p className="text-sm text-im8-burgundy/60 mb-4">
              Due: <span className="font-medium text-im8-burgundy">{new Date(brief.due_date).toLocaleDateString()}</span>
            </p>
          )}
          <div className="prose prose-sm max-w-none text-im8-burgundy whitespace-pre-wrap">
            {brief.body_markdown || <span className="text-im8-burgundy/40 italic">No brief content yet.</span>}
          </div>
        </div>

        {submissions && submissions.length > 0 && (
          <div className="bg-white rounded-xl border border-im8-stone/20 p-6">
            <h2 className="text-base font-semibold text-im8-burgundy mb-4">Your Submissions</h2>
            <div className="space-y-3">
              {submissions.map((sub) => {
                const statusColors: Record<string, string> = {
                  pending: "bg-gray-100 text-gray-600",
                  approved: "bg-green-100 text-green-700",
                  rejected: "bg-red-100 text-red-700",
                  revision_requested: "bg-amber-100 text-amber-700",
                };
                return (
                  <div key={sub.id} className="border border-im8-sand rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-sm text-im8-burgundy font-medium">{sub.file_name || "Untitled"}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[sub.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {sub.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-im8-burgundy/40">{new Date(sub.submitted_at).toLocaleDateString()}</p>
                    {sub.feedback && (
                      <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-xs font-semibold text-amber-800 mb-1">Feedback</p>
                        <p className="text-sm text-amber-900">{sub.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
