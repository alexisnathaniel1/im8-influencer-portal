import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  if (profile.role === "admin" || profile.role === "ops" || profile.role === "finance") {
    redirect("/admin");
  }
  if (profile.role === "approver") redirect("/approver");
  redirect("/influencer");
}
