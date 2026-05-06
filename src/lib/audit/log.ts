import { createAdminClient } from "@/lib/supabase/admin";

type EntityType = "discovery_profile" | "deal" | "approval_packet" | "submission" | "brief";

export async function logAuditEvent(params: {
  actorId: string;
  entityType: EntityType;
  entityId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audit_events").insert({
    actor_id: params.actorId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    before: params.before ?? null,
    after: params.after ?? null,
  });
  if (error) {
    // Log clearly so server logs surface any DB-level failures (FK violation,
    // missing enum value, etc.) that were previously swallowed silently.
    console.error(
      `[audit/log] INSERT failed for action="${params.action}" entity="${params.entityId}":`,
      error.message,
      error,
    );
  }
}
