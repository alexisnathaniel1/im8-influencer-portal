"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "⬛" },
  { href: "/admin/discovery", label: "Discovery", icon: "🔍" },
  { href: "/admin/approvals", label: "Approvals", icon: "✅" },
  { href: "/admin/deals", label: "Partner Tracker", icon: "🤝" },
  { href: "/admin/review", label: "Content Review", icon: "🎬" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default function AdminNav({ profile }: { profile: { full_name: string; role: string; email: string } }) {
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
        <p className="text-xs text-white/50 mt-2 uppercase tracking-wider">Influencer Portal</p>
      </div>

      <div className="flex-1 py-4 overflow-y-auto">
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                active ? "bg-white/15 text-white font-medium" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/50 mb-1 truncate">{profile.full_name}</div>
        <div className="text-xs text-white/30 mb-3 capitalize">{profile.role}</div>
        <button onClick={signOut}
          className="w-full text-xs text-white/50 hover:text-white py-1 text-left transition-colors">
          Sign out →
        </button>
      </div>
    </nav>
  );
}
