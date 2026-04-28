import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Image from "next/image";
import Link from "next/link";
import SignOutButton from "@/components/shared/sign-out-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/auth/login");
  if (["admin", "management", "support"].includes(profile.role)) redirect("/admin");
  if (!["editor", "influencer"].includes(profile.role)) redirect("/partner");

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <header className="bg-white border-b border-im8-stone/20 sticky top-0 z-10">
        <div className="max-w-[1080px] mx-auto px-10 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-im8-burgundy rounded-lg p-2">
              <Image src="/logo-white.svg" alt="IM8" width={36} height={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-im8-maroon">{profile.full_name || profile.email}</div>
              <div className="text-[11px] text-im8-muted uppercase tracking-[0.08em]">Editor</div>
            </div>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/editor" className="text-im8-maroon font-medium hover:text-im8-red transition-colors">My deals</Link>
            <SignOutButton className="text-im8-muted hover:text-im8-maroon text-sm transition-colors" />
          </nav>
        </div>
      </header>
      <main className="max-w-[1080px] mx-auto px-10 py-8">{children}</main>
    </div>
  );
}
