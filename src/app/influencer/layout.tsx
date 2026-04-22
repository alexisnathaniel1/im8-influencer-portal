import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InfluencerNav from "@/components/shared/influencer-nav";

export default async function InfluencerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "influencer") {
    if (["admin", "ops", "finance"].includes(profile?.role ?? "")) redirect("/admin");
    if (profile?.role === "approver") redirect("/approver");
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-im8-offwhite flex">
      <InfluencerNav profile={profile} />
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
