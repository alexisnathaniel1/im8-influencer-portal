import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamSettings from "./team-settings";
import { ADMIN_ROLES } from "@/lib/permissions";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) redirect("/admin");

  const admin = createAdminClient();
  const { data: team } = await admin
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .in("role", ["owner", "admin", "ops", "management", "influencer_team", "finance", "approver", "editor"])
    .order("created_at");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link href="/admin" className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Dashboard</Link>
        <h1 className="text-3xl font-bold text-im8-burgundy">Settings</h1>
        <p className="text-im8-burgundy/60 mt-1">Manage team members and their portal access.</p>
      </div>

      <TeamSettings members={team ?? []} currentRole={profile.role} />
    </div>
  );
}
