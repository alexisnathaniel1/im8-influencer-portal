import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  revision_requested: "bg-orange-100 text-orange-700",
};

export default async function PartnerSubmissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: submissions } = await supabase
    .from("submissions")
    .select("*, briefs(title), deals(influencer_name), deliverables(deliverable_type, sequence)")
    .eq("influencer_id", user!.id)
    .order("submitted_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">My Submissions</h1>
        <p className="text-im8-burgundy/60 mt-1">{submissions?.length ?? 0} total submissions</p>
      </div>

      {!submissions?.length ? (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No submissions yet.{" "}
          <Link href="/partner/submit" className="text-im8-red hover:underline">Upload your first draft →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(s => {
            const deliv = s.deliverables as { deliverable_type: string; sequence: number | null } | null;
            return (
            <div key={s.id} className="bg-white rounded-xl border border-im8-stone/30 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {deliv && (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold font-mono bg-purple-100 text-purple-700">
                        {deliv.deliverable_type}{deliv.sequence ? ` #${deliv.sequence}` : ""}
                      </span>
                    )}
                    <div className="font-medium text-im8-burgundy text-sm">{s.file_name ?? "Video"}</div>
                  </div>
                  <div className="text-xs text-im8-burgundy/50 mt-1 flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[s.status] ?? ""}`}>
                      {s.status.replace("_", " ")}
                    </span>
                    <span>{new Date(s.submitted_at).toLocaleDateString()}</span>
                    {(s.briefs as { title: string } | null)?.title && (
                      <span>· {(s.briefs as { title: string }).title}</span>
                    )}
                  </div>
                  {s.feedback && (
                    <div className="mt-3 bg-im8-sand/50 rounded-lg px-4 py-3 text-sm text-im8-burgundy/80">
                      <span className="font-medium">Feedback: </span>{s.feedback}
                    </div>
                  )}
                </div>
                {s.drive_url && (
                  <a href={s.drive_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-im8-red hover:underline shrink-0">View file →</a>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
