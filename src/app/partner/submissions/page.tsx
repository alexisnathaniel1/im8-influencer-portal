import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  revision_requested: "bg-orange-100 text-orange-700",
};

type Submission = {
  id: string;
  file_name: string | null;
  drive_url: string | null;
  status: string;
  feedback: string | null;
  submitted_at: string;
  deal_id: string | null;
  deliverable_id: string | null;
  deliverables?: { deliverable_type: string; sequence: number | null } | { deliverable_type: string; sequence: number | null }[] | null;
  deals?: { influencer_name: string } | { influencer_name: string }[] | null;
};

export default async function PartnerSubmissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rawSubmissions } = await supabase
    .from("submissions")
    .select("id, file_name, drive_url, status, feedback, submitted_at, deal_id, deliverable_id, briefs(title), deals(influencer_name), deliverables(deliverable_type, sequence)")
    .eq("influencer_id", user!.id)
    .order("submitted_at", { ascending: false });

  const submissions = (rawSubmissions ?? []) as unknown as Submission[];

  // Group by deliverable_id — so IGR #1's three revision rounds appear as one
  // thread. Submissions not linked to a deliverable go into a synthetic "misc"
  // bucket so they stay visible.
  type Group = {
    key: string;
    label: string;
    dealName: string;
    dealId: string | null;
    deliverableId: string | null;
    versions: Submission[];   // already sorted newest-first from the query
  };
  const groupMap = new Map<string, Group>();
  for (const s of submissions) {
    const deliv = (Array.isArray(s.deliverables) ? s.deliverables[0] : s.deliverables) ?? null;
    const deal = (Array.isArray(s.deals) ? s.deals[0] : s.deals) ?? null;
    const key = s.deliverable_id ?? `misc:${s.id}`;   // misc bucket per submission
    const label = deliv
      ? `${deliv.deliverable_type}${deliv.sequence ? ` #${deliv.sequence}` : ""}`
      : (s.file_name ?? "Untitled upload");
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        label,
        dealName: deal?.influencer_name ?? "",
        dealId: s.deal_id,
        deliverableId: s.deliverable_id,
        versions: [],
      });
    }
    groupMap.get(key)!.versions.push(s);
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const latestA = new Date(a.versions[0]?.submitted_at ?? 0).getTime();
    const latestB = new Date(b.versions[0]?.submitted_at ?? 0).getTime();
    return latestB - latestA;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">My Submissions</h1>
        <p className="text-im8-burgundy/60 mt-1">
          {submissions.length} total upload{submissions.length === 1 ? "" : "s"} across {groups.length} deliverable{groups.length === 1 ? "" : "s"}
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No submissions yet.{" "}
          <Link href="/partner/submit" className="text-im8-red hover:underline">Upload your first draft →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const latest = g.versions[0];
            const needsRevision = latest?.status === "revision_requested";
            const isApproved = latest?.status === "approved";
            return (
              <div key={g.key}
                className={`bg-white rounded-xl border p-5 ${needsRevision ? "border-orange-300 bg-orange-50/30" : isApproved ? "border-emerald-200" : "border-im8-stone/30"}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold font-mono bg-purple-100 text-purple-700">
                        {g.label}
                      </span>
                      {g.dealName && <span className="text-xs text-im8-burgundy/60">for {g.dealName}</span>}
                      <span className="text-xs text-im8-burgundy/40">
                        · {g.versions.length} version{g.versions.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  {needsRevision && g.dealId && g.deliverableId && (
                    <Link
                      href={`/partner/submit?dealId=${g.dealId}&deliverableId=${g.deliverableId}`}
                      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-im8-red text-white text-sm font-medium rounded-lg hover:bg-im8-burgundy transition-colors"
                    >
                      ↻ Upload new version
                    </Link>
                  )}
                </div>

                {/* Versions thread */}
                <div className="mt-4 space-y-3">
                  {g.versions.map((v, i) => (
                    <div key={v.id} className={`relative pl-5 ${i < g.versions.length - 1 ? "pb-3 border-b border-im8-stone/10" : ""}`}>
                      {/* Timeline dot */}
                      <span className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${
                        v.status === "approved" ? "bg-emerald-500"
                        : v.status === "revision_requested" ? "bg-orange-500"
                        : v.status === "rejected" ? "bg-red-500"
                        : "bg-yellow-500"
                      }`} />
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-im8-burgundy/40 font-semibold uppercase tracking-wide">
                              v{g.versions.length - i}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[v.status] ?? ""}`}>
                              {v.status.replace("_", " ")}
                            </span>
                            <span className="text-xs text-im8-burgundy/50">
                              {new Date(v.submitted_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                          <div className="text-sm text-im8-burgundy mt-0.5">{v.file_name ?? "Video"}</div>
                          {v.feedback && (
                            <div className="mt-2 bg-im8-sand/60 border border-im8-stone/20 rounded-lg px-3 py-2 text-sm text-im8-burgundy/80">
                              <span className="text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">
                                Feedback from IM8
                              </span>
                              <p className="mt-0.5 whitespace-pre-wrap">{v.feedback}</p>
                            </div>
                          )}
                        </div>
                        {v.drive_url && (
                          <a href={v.drive_url} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-im8-red hover:underline shrink-0">View file →</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
