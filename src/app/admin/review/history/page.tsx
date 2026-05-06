import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ADMIN_ROLES } from "@/lib/permissions";
import HistoryClient from "./history-client";

export default async function ReviewHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) redirect("/admin");

  const admin = createAdminClient();
  const { data: rawEvents } = await admin
    .from("audit_events")
    .select(`id, action, before, after, created_at, entity_id, actor:actor_id(full_name)`)
    .eq("entity_type", "submission")
    .order("created_at", { ascending: false })
    .limit(200);

  // Cast to a mutable, well-typed shape so we can inject enrichment below.
  const events = (rawEvents ?? []) as Array<{
    id: string;
    action: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    created_at: string;
    entity_id: string;
    actor: { full_name: string } | { full_name: string }[] | null;
  }>;

  // Enrich events that are missing influencer / deliverable context.
  // Old events were logged before the enrichment logic was added to the API routes.
  // For non-deleted submissions still in the DB we can look them up directly.
  const needsEnrich = events.filter(e => !e.before?.influencer_name);
  if (needsEnrich.length > 0) {
    const entityIds = [...new Set(needsEnrich.map(e => e.entity_id))];
    const { data: subs } = await admin
      .from("submissions")
      .select(`
        id, file_name, variant_label,
        deal:deal_id(influencer_name),
        deliverable:deliverable_id(deliverable_type, sequence)
      `)
      .in("id", entityIds);

    // Build a lookup map: submission id → enrichment context
    const ctxMap = new Map<string, Record<string, unknown>>();
    for (const sub of subs ?? []) {
      const dealSnap = Array.isArray(sub.deal) ? sub.deal[0] : sub.deal;
      const delivSnap = Array.isArray(sub.deliverable) ? sub.deliverable[0] : sub.deliverable;
      ctxMap.set(sub.id as string, {
        influencer_name:
          (dealSnap as { influencer_name?: string } | null)?.influencer_name ?? null,
        deliverable_type:
          (delivSnap as { deliverable_type?: string } | null)?.deliverable_type ?? null,
        deliverable_sequence:
          (delivSnap as { sequence?: number } | null)?.sequence ?? null,
        file_name: sub.file_name ?? null,
        variant_label: sub.variant_label ?? null,
      });
    }

    // Merge context into each event that is missing it
    for (const event of events) {
      if (!event.before?.influencer_name) {
        const ctx = ctxMap.get(event.entity_id);
        if (ctx) {
          event.before = { ...(event.before ?? {}), ...ctx };
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HistoryClient events={events} />
      </div>
    </div>
  );
}
