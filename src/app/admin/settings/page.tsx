import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/admin");

  const admin = createAdminClient();
  const { data: team } = await admin
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .in("role", ["admin", "ops", "finance", "approver"])
    .order("role");

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-im8-burgundy text-white",
    ops: "bg-im8-red/80 text-white",
    finance: "bg-blue-100 text-blue-700",
    approver: "bg-green-100 text-green-700",
  };

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/admin" className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-im8-burgundy">Settings</h1>
        </div>

        <div className="bg-white rounded-xl border border-im8-stone/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-im8-burgundy">Team Members</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-im8-sand">
              <tr>
                <th className="text-left pb-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Name</th>
                <th className="text-left pb-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Email</th>
                <th className="text-left pb-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Role</th>
                <th className="text-left pb-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-im8-sand/50">
              {(team ?? []).map((member) => (
                <tr key={member.id}>
                  <td className="py-3 font-medium text-im8-burgundy">{member.full_name || "—"}</td>
                  <td className="py-3 text-im8-burgundy/70">{member.email}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[member.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="py-3 text-im8-burgundy/50">{new Date(member.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-im8-burgundy/40 mt-4">To add or change team members, update roles directly in Supabase Auth or contact your system administrator.</p>
        </div>
      </div>
    </div>
  );
}
