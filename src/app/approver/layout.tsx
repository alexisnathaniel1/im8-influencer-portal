import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ApproverNav from "@/components/shared/approver-nav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApproverLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "approver") {
    if (["admin", "ops", "finance"].includes(profile?.role ?? "")) redirect("/admin");
    if (profile?.role === "influencer") redirect("/influencer");
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-im8-offwhite flex">
      <ApproverNav profile={profile} />
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
