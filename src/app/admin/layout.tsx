import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/shared/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "ops", "finance"].includes(profile.role)) {
    if (profile?.role === "approver") redirect("/approver");
    if (profile?.role === "influencer") redirect("/influencer");
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-im8-offwhite flex">
      <AdminNav profile={profile} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
