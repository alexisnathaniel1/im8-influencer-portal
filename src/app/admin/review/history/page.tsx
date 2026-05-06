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
  const { data: events } = await admin
    .from("audit_events")
    .select(`id, action, before, after, created_at, entity_id, actor:actor_id(full_name)`)
    .eq("entity_type", "submission")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HistoryClient events={events ?? []} />
      </div>
    </div>
  );
}
