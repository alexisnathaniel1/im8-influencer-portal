import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ApproverHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: packets } = await supabase
    .from("approval_packets")
    .select("*, created_by(full_name)")
    .contains("approver_ids", [user!.id])
    .order("created_at", { ascending: false });

  const pending = packets?.filter(p => p.status === "pending") ?? [];
  const decided = packets?.filter(p => p.status !== "pending") ?? [];

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    partially_approved: "bg-orange-100 text-orange-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-600",
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">My Approvals</h1>
        <p className="text-im8-burgundy/60 mt-1">Influencer partnership requests awaiting your review</p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-im8-burgundy">Pending ({pending.length})</h2>
          {pending.map(p => (
            <Link key={p.id} href={`/approver/packets/${p.id}`}
              className="block bg-white rounded-xl border border-im8-red/30 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-im8-burgundy">{p.title}</h3>
                  <p className="text-xs text-im8-burgundy/50 mt-1">
                    {p.deal_ids?.length ?? 0} influencers · submitted by {(p.created_by as { full_name: string } | null)?.full_name ?? "Admin"}
                    · {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium">Action required</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-im8-burgundy">Decided ({decided.length})</h2>
          {decided.map(p => (
            <Link key={p.id} href={`/approver/packets/${p.id}`}
              className="block bg-white rounded-xl border border-im8-stone/30 p-5 hover:shadow-sm transition-shadow opacity-75">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-im8-burgundy">{p.title}</h3>
                  <p className="text-xs text-im8-burgundy/50 mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[p.status] ?? ""}`}>
                  {p.status.replace("_", " ")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!packets?.length && (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No approvals yet. The IM8 team will notify you when deals are ready for review.
        </div>
      )}
    </div>
  );
}
