import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import EditorDeliverableCard from "./editor-deliverable-card";

export default async function EditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  // Only active (not completed) deliverables assigned to this editor
  const { data: rawDeliverables } = await admin
    .from("deliverables")
    .select(`
      id, deliverable_type, platform, title, status, due_date, is_story,
      deal:deal_id(id, influencer_name, platform_primary, status)
    `)
    .eq("assigned_editor_id", user.id)
    .not("status", "in", '("completed")')
    .order("due_date", { ascending: true, nullsFirst: false });

  // Flatten Supabase's array-typed FK joins
  const deliverables = (rawDeliverables ?? []).map(d => ({
    ...d,
    deal: Array.isArray(d.deal) ? d.deal[0] ?? null : d.deal,
  })).filter(d => d.deal);

  // Count existing edited-video uploads per deliverable
  const deliverableIds = deliverables.map(d => d.id);
  const uploadCounts: Record<string, number> = {};
  if (deliverableIds.length > 0) {
    const { data: evs } = await admin
      .from("edited_videos")
      .select("deliverable_id")
      .in("deliverable_id", deliverableIds)
      .eq("uploaded_by", user.id);
    (evs ?? []).forEach(ev => {
      if (ev.deliverable_id) {
        uploadCounts[ev.deliverable_id] = (uploadCounts[ev.deliverable_id] ?? 0) + 1;
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">My deliverables</h1>
        <p className="text-im8-burgundy/60 mt-1">Upload edited videos for each piece of content you&apos;re assigned to.</p>
      </div>

      {deliverables.length === 0 ? (
        <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
          No active deliverables assigned to you yet.
        </div>
      ) : (
        <div className="space-y-4">
          {deliverables.map(d => (
            <EditorDeliverableCard
              key={d.id}
              deliverable={d}
              uploadCount={uploadCounts[d.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
