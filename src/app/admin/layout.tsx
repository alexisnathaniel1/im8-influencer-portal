import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/shared/admin-nav";
import { ADMIN_ROLES } from "@/lib/permissions";

// Prevent Vercel edge from caching the auth-based redirect
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    if (profile?.role === "editor") redirect("/editor");
    if (profile?.role === "influencer" || profile?.role === "agency") redirect("/partner");
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-im8-offwhite flex">
      <AdminNav profile={profile} />
      <main className="flex-1 ml-64 overflow-y-auto min-h-screen bg-im8-offwhite">
        <div className="max-w-[1080px] mx-auto px-10 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
