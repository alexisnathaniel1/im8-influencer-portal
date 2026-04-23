import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/permissions";

// Prevent Vercel edge from caching the auth-based redirect
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/auth/login");

  if (ADMIN_ROLES.includes(profile.role)) redirect("/admin");
  if (profile.role === "editor") redirect("/editor");
  redirect("/partner");
}
