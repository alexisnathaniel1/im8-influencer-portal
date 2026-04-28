"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── SVG Icons (16×16, currentColor) ────────────────────────────────────────
const Icons: Record<string, React.FC<{ className?: string }>> = {
  dashboard: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
    </svg>
  ),
  briefs: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="1.5" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  submit: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 11V2M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  submissions: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 10.5l6 3 6-3M2 7.5l6 3 6-3M2 4.5l6-3 6 3-6 3-6-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  profile: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1.5 14c0-3.03 2.91-5.5 6.5-5.5s6.5 2.47 6.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

const NAV = [
  { href: "/influencer",             label: "Dashboard",      icon: "dashboard"   },
  { href: "/influencer/briefs",      label: "My Briefs",      icon: "briefs"      },
  { href: "/influencer/submit",      label: "Submit Content", icon: "submit"      },
  { href: "/influencer/submissions", label: "My Submissions", icon: "submissions" },
  { href: "/influencer/profile",     label: "Profile",        icon: "profile"     },
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
      {/* Logo + portal label */}
      <div className="px-6 py-5 border-b border-white/10">
        <Image src="/logo-white.svg" alt="IM8" width={56} height={28} />
        <p className="text-[10px] font-bold text-im8-gold/80 mt-2.5 uppercase tracking-[0.15em]">
          Creator Portal
        </p>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-3">
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== "/influencer" && pathname.startsWith(item.href));
          const IconComponent = Icons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-[13px] transition-colors border-l-2 ${
                active
                  ? "text-white font-medium bg-white/10 border-im8-flamingo"
                  : "text-white/55 hover:text-white hover:bg-white/8 border-transparent"
              }`}
            >
              {IconComponent && (
                <IconComponent className={`shrink-0 ${active ? "text-white" : "text-white/50"}`} />
              )}
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* User footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <div className="text-[13px] font-medium text-white/85 truncate">{profile.full_name}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-im8-flamingo/70 uppercase tracking-[0.08em]">Creator</span>
          <button
            onClick={signOut}
            className="text-[11px] text-white/40 hover:text-white/80 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
