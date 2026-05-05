"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAllowedNav } from "@/lib/permissions";

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
  discovery: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  approvals: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  tracker: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 12.5c0-2.21 2-4 4.5-4s4.5 1.79 4.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M11 8.7c1.38.37 2.5 1.66 2.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  deliverables: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5.5h6M5 8.5h6M5 11.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  calendar: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 1v3M11 1v3M1.5 7h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="5" cy="10.5" r="1" fill="currentColor"/>
      <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
      <circle cx="11" cy="10.5" r="1" fill="currentColor"/>
    </svg>
  ),
  inbox: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1.5 9.5h3.5l1.5 2h3l1.5-2h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M4 5.5l4 3 4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  review: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6.5 5.5l4.5 2.5-4.5 2.5V5.5z" fill="currentColor"/>
    </svg>
  ),
  settings: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.54 3.46l-1.06 1.06M4.52 11.48l-1.06 1.06M12.54 12.54l-1.06-1.06M4.52 4.52L3.46 3.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  workflow: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 2v12M13 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="4" r="1.5" fill="currentColor"/>
      <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="8" cy="12" r="1.5" fill="currentColor"/>
      <path d="M3 4h5M8 8h5M3 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  ),
  roster: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1.5 5.5h13M5.5 1.5v13" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
};

const NAV = [
  { href: "/admin",              label: "Dashboard",      icon: "dashboard"    },
  { href: "/admin/discovery",    label: "Discovery",      icon: "discovery"    },
  { href: "/admin/approvals",    label: "Approvals",      icon: "approvals"    },
  { href: "/admin/workflow",     label: "Workflow",       icon: "workflow"     },
  { href: "/admin/deals",        label: "Partner Tracker",icon: "tracker"      },
  { href: "/admin/roster",       label: "Roster",         icon: "roster"       },
  { href: "/admin/deliverables", label: "Deliverables",   icon: "deliverables" },
  { href: "/admin/calendar",     label: "Calendar",       icon: "calendar"     },
  { href: "/admin/review",       label: "Content Review", icon: "review"       },
  { href: "/admin/inbox",        label: "Inbox",          icon: "inbox"        },
  { href: "/admin/settings",     label: "Settings",       icon: "settings"     },
];

export default function AdminNav({ profile }: { profile: { full_name: string; role: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const allowed = getAllowedNav(profile.role);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const visibleNav = NAV.filter(item => allowed.includes(item.href));

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-im8-burgundy text-white flex flex-col">
      {/* Logo + portal label */}
      <div className="px-6 py-5 border-b border-white/10">
        <Image src="/logo-white.svg" alt="IM8" width={56} height={28} />
        <p className="text-[10px] font-bold text-im8-gold/80 mt-2.5 uppercase tracking-[0.15em]">
          Influencer Portal
        </p>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-3 overflow-y-auto">
        {visibleNav.map(item => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          const IconComponent = Icons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-[13px] transition-colors relative ${
                active
                  ? "text-white font-medium bg-white/10 border-l-2 border-im8-flamingo"
                  : "text-white/55 hover:text-white hover:bg-white/8 border-l-2 border-transparent"
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
          <span className="text-[11px] text-im8-flamingo/70 uppercase tracking-[0.08em] capitalize">
            {profile.role.replace("_", " ")}
          </span>
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
