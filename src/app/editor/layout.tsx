import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Image from "next/image";
import Link from "next/link";

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
  if (["admin", "ops", "finance"].includes(profile.role)) redirect("/admin");
  if (profile.role === "approver") redirect("/approver");
  if (!["editor", "influencer"].includes(profile.role)) redirect("/partner");

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
              <div className="text-xs text-im8-burgundy/50">Editor</div>
            </div>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/editor" className="text-im8-burgundy hover:text-im8-red font-medium">My deals</Link>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="text-im8-burgundy/50 hover:text-im8-burgundy text-sm">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
