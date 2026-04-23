import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import ApprovalsDashboard from "@/components/approvals/approvals-dashboard";
import { canViewRates } from "@/lib/permissions";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const showRates = canViewRates(profile?.role ?? "");

  const admin = createAdminClient();

  const { data: agreedDeals } = await admin
    .from("deals")
    .select("*")
    .eq("status", "agreed")
    .order("updated_at", { ascending: false });

  const { data: packets } = await admin
    .from("approval_packets")
    .select("*, created_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(20);

  // Pick approvers from staff who should sign off on packets — Admin + Management
  const { data: approvers } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["admin", "management"]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">Approvals</h1>
        <p className="text-im8-burgundy/60 mt-1">Bundle agreed deals for management sign-off</p>
      </div>
      <ApprovalsDashboard agreedDeals={agreedDeals ?? []} packets={packets ?? []} approvers={approvers ?? []} canViewRates={showRates} />
    </div>
  );
}
