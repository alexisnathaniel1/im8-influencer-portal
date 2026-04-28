import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import ApprovalsDashboard from "@/components/approvals/approvals-dashboard";
import { canViewRates } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const showRates = canViewRates(profile?.role ?? "");

  const admin = createAdminClient();

  // Fetch all approval packets first so we can compute which deals are
  // already attached to a packet and exclude them from the "Ready for approval"
  // pool. Otherwise a deal would show in both lists once a packet is created.
  const { data: packets } = await admin
    .from("approval_packets")
    .select("*, created_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(20);

  const dealIdsInPackets = new Set<string>();
  for (const p of packets ?? []) {
    for (const id of (p.deal_ids ?? []) as string[]) dealIdsInPackets.add(id);
  }

  // "Ready for approval" = deals whose status is pending_approval and that
  // aren't already part of an existing packet.
  const { data: pendingDeals } = await admin
    .from("deals")
    .select("*")
    .eq("status", "pending_approval")
    .order("updated_at", { ascending: false });

  const readyDeals = (pendingDeals ?? []).filter(d => !dealIdsInPackets.has(d.id as string));

  // For each packet, also fetch the deals it contains so the side panel can
  // render rich per-deal cards (rate, deliverables, rationale, link).
  const allPacketDealIds = Array.from(dealIdsInPackets);
  const { data: packetDeals } = allPacketDealIds.length > 0
    ? await admin.from("deals").select("*").in("id", allPacketDealIds)
    : { data: [] as Record<string, unknown>[] };

  // Pick approvers from staff who should sign off on packets — Admin + Management
  const { data: approvers } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["admin", "management"]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">Approvals</h1>
        <p className="text-im8-burgundy/60 mt-1">Review approved deals, edit their rationale, and send batches to management for sign-off.</p>
      </div>
      <ApprovalsDashboard
        readyDeals={readyDeals}
        packets={packets ?? []}
        packetDeals={packetDeals ?? []}
        approvers={approvers ?? []}
        canViewRates={showRates}
        userId={user.id}
      />
    </div>
  );
}
