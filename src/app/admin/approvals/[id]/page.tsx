import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { canViewRates } from "@/lib/permissions";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  const [{ data: packet }, { data: decisions }] = await Promise.all([
    admin.from("approval_packets").select("*, creator:created_by(full_name)").eq("id", id).single(),
    admin.from("approval_decisions").select("*, approver:approver_id(full_name)").eq("packet_id", id),
  ]);

  if (!packet) redirect("/admin/approvals");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const showRates = canViewRates((profile as { role?: string } | null)?.role ?? "");

  const dealIds: string[] = packet.deal_ids ?? [];
  const { data: deals } = await admin.from("deals").select("id, influencer_name, monthly_rate_cents, total_months, total_rate_cents, status, rationale").in("id", dealIds);

  const statusColor: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    partially_approved: "bg-amber-100 text-amber-700",
    pending: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/admin/approvals" className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Approvals</Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-im8-burgundy">{packet.title}</h1>
              <p className="text-sm text-im8-burgundy/60">
                Created by {(packet.creator as unknown as { full_name: string } | null)?.full_name ?? "Unknown"} · {new Date(packet.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor[packet.status] ?? "bg-gray-100 text-gray-600"}`}>
              {packet.status.replace("_", " ")}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {(deals ?? []).map((deal) => {
            const dealDecisions = (decisions ?? []).filter((d) => d.deal_id === deal.id);
            return (
              <div key={deal.id} className="bg-white rounded-xl border border-im8-stone/20 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <Link href={`/admin/deals/${deal.id}`} className="text-lg font-semibold text-im8-burgundy hover:underline">
                      {deal.influencer_name}
                    </Link>
                    {showRates && (
                      <p className="text-sm text-im8-burgundy/60 mt-0.5">
                        ${deal.monthly_rate_cents ? (deal.monthly_rate_cents / 100).toFixed(0) : "??"}/mo × {deal.total_months ?? "??"} months
                        {deal.total_rate_cents ? ` = $${(deal.total_rate_cents / 100).toFixed(0)} total` : ""}
                      </p>
                    )}
                    {deal.rationale && (
                      <p className="text-sm text-im8-burgundy/70 mt-2 italic">&ldquo;{deal.rationale}&rdquo;</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[deal.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {deal.status}
                  </span>
                </div>

                {dealDecisions.length > 0 && (
                  <div className="border-t border-im8-sand pt-4">
                    <p className="text-xs font-semibold text-im8-burgundy/60 mb-3">Decisions</p>
                    <div className="space-y-2">
                      {dealDecisions.map((d) => {
                        const approver = d.approver as unknown as { full_name: string } | null;
                        return (
                          <div key={d.id} className="flex items-start gap-3">
                            <span className={`mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${d.decision === "approved" ? "bg-green-500" : "bg-red-500"}`} />
                            <div>
                              <span className="text-sm font-medium text-im8-burgundy">{approver?.full_name ?? "Unknown"}</span>
                              <span className={`ml-2 text-xs font-medium ${d.decision === "approved" ? "text-green-700" : "text-red-700"}`}>
                                {d.decision}
                              </span>
                              {d.comment && <p className="text-xs text-im8-burgundy/60 mt-0.5">{d.comment}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
