"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/influencer", label: "Dashboard", icon: "⬛" },
  { href: "/influencer/briefs", label: "My Briefs", icon: "📋" },
  { href: "/influencer/submit", label: "Submit Content", icon: "⬆️" },
  { href: "/influencer/submissions", label: "My Submissions", icon: "🎬" },
  { href: "/influencer/profile", label: "Profile", icon: "👤" },
];

export default function InfluencerNav({ profile }: { profile: { full_name: string; role: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-im8-burgundy text-white flex flex-col">
      <div className="p-6 border-b border-white/10">
        <Image src="/logo-white.svg" alt="IM8" width={60} height={30} />
        <p className="text-xs text-white/50 mt-2 uppercase tracking-wider">Creator Portal</p>
      </div>
      <div className="flex-1 py-4">
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== "/influencer" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                active ? "bg-white/15 text-white font-medium" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/50 mb-3 truncate">{profile.full_name}</div>
        <button onClick={signOut} className="text-xs text-white/50 hover:text-white transition-colors">Sign out →</button>
      </div>
    </nav>
  );
}
