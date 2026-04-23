import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import EditedVideosClient from "./edited-videos-client";

export default async function PartnerEditedVideosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  // Fetch deals this influencer is linked to
  const { data: deals } = await admin
    .from("deals")
    .select("id, influencer_name")
    .eq("influencer_profile_id", user.id)
    .in("status", ["contracted", "live", "completed"]);

  const dealIds = (deals ?? []).map(d => d.id);

  const editedVideos = dealIds.length > 0
    ? (await admin
        .from("edited_videos")
        .select("id, deal_id, original_file_name, canonical_file_name, drive_url, admin_status, influencer_status, created_at")
        .in("deal_id", dealIds)
        .order("created_at", { ascending: false })).data ?? []
    : [];

  const dealMap = Object.fromEntries((deals ?? []).map(d => [d.id, d.influencer_name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">Edited videos</h1>
        <p className="text-im8-burgundy/60 mt-1">Review and approve edited videos from the IM8 team.</p>
      </div>
      <EditedVideosClient videos={editedVideos} dealMap={dealMap} />
    </div>
  );
}
