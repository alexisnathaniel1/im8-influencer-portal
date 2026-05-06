import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ADMIN_ROLES } from "@/lib/permissions";
import LogClient from "./log-client";

export const dynamic = "force-dynamic";

export default async function LogReceivedContentPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string; deliverableId?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) redirect("/auth/login");

  const admin = createAdminClient();

  // Fetch all active deals with their deliverables
  const { data: deals } = await admin
    .from("deals")
    .select(`
      id,
      influencer_name,
      drive_folder_id,
      contract_sequence,
      deliverables(id, deliverable_type, sequence, status)
    `)
    .in("status", ["approved", "contracted", "live"])
    .order("influencer_name", { ascending: true });

  const { dealId: preselectedDealId, deliverableId: preselectedDeliverableId } = await searchParams;

  return (
    <LogClient
      deals={deals ?? []}
      preselectedDealId={preselectedDealId ?? null}
      preselectedDeliverableId={preselectedDeliverableId ?? null}
    />
  );
}
