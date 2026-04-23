import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SignOutButton from "./sign-out-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name, partner_type, email")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/auth/login");
  if (["admin", "ops", "finance"].includes(profile.role)) redirect("/admin");
  if (profile.role === "approver") redirect("/approver");
  if (profile.role === "editor") redirect("/editor");

  // Check if this user has an active deal (influencer campaign access)
  const { data: activeDeals } = await admin
    .from("deals")
    .select("id")
    .eq("influencer_profile_id", user.id)
    .in("status", ["approved", "contracted", "live"])
    .limit(1);

  const hasDeal = (activeDeals ?? []).length > 0;

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <header className="bg-white border-b border-im8-stone/30 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-im8-burgundy rounded-lg p-2">
              <Image src="/logo-white.svg" alt="IM8" width={40} height={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-im8-burgundy">{profile.full_name || profile.email}</div>
              <div className="text-xs text-im8-burgundy/50 capitalize">
                {profile.role === "influencer" ? "Creator" : (profile.partner_type ?? "creator")}
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/partner" className="text-im8-burgundy hover:text-im8-red font-medium">
              {hasDeal ? "Dashboard" : "Submissions"}
            </Link>
            {hasDeal && (
              <>
                <Link href="/partner/briefs" className="text-im8-burgundy/70 hover:text-im8-red">Briefs</Link>
                <Link href="/partner/submissions" className="text-im8-burgundy/70 hover:text-im8-red">My submissions</Link>
                <Link href="/partner/submit" className="text-im8-burgundy/70 hover:text-im8-red">Upload content</Link>
                <Link href="/partner/edited-videos" className="text-im8-burgundy/70 hover:text-im8-red">Edited videos</Link>
              </>
            )}
            {!hasDeal && (
              <Link href="/intake" className="text-im8-burgundy/70 hover:text-im8-red">+ New submission</Link>
            )}
            <Link href="/partner/settings" className="text-im8-burgundy/70 hover:text-im8-red">Settings</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
