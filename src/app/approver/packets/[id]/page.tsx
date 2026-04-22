import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PacketReviewClient from "@/components/approvals/packet-review-client";

export default async function PacketReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: packet } = await supabase
    .from("approval_packets")
    .select("*")
    .eq("id", id)
    .single();

  if (!packet) notFound();

  // Load the actual deals in this packet
  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .in("id", packet.deal_ids ?? []);

  // Load existing decisions by this approver
  const { data: myDecisions } = await supabase
    .from("approval_decisions")
    .select("*")
    .eq("packet_id", id)
    .eq("approver_id", user!.id);

  return (
    <div className="max-w-3xl animate-fade-in">
      <PacketReviewClient
        packet={packet}
        deals={deals ?? []}
        myDecisions={myDecisions ?? []}
        approverId={user!.id}
      />
    </div>
  );
}
