import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import EditorDealCard from "./editor-deal-card";

export default async function EditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  // Get deals this editor is assigned to
  const { data: assignments } = await admin
    .from("deal_editors")
    .select("deal_id")
    .eq("editor_id", user.id);

  const dealIds = (assignments ?? []).map(a => a.deal_id);

  const deals = dealIds.length > 0
    ? (await admin
        .from("deals")
        .select("id, influencer_name, platform_primary, status, deliverables")
        .in("id", dealIds)
        .in("status", ["contracted", "live"])).data ?? []
    : [];

  // Fetch edited videos per deal
  const editedVideosByDeal: Record<string, number> = {};
  if (dealIds.length > 0) {
    const { data: evs } = await admin
      .from("edited_videos")
      .select("deal_id")
      .in("deal_id", dealIds)
      .eq("uploaded_by", user.id);
    (evs ?? []).forEach(ev => {
      editedVideosByDeal[ev.deal_id] = (editedVideosByDeal[ev.deal_id] ?? 0) + 1;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">My deals</h1>
        <p className="text-im8-burgundy/60 mt-1">Upload edited videos for each collaboration you&apos;re assigned to.</p>
      </div>

      {deals.length === 0 ? (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No active deals assigned to you yet.
        </div>
      ) : (
        <div className="space-y-4">
          {deals.map(deal => (
            <EditorDealCard
              key={deal.id}
              deal={deal}
              uploadCount={editedVideosByDeal[deal.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
