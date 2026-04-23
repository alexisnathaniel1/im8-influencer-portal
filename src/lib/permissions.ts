export type AdminRole = "admin" | "management" | "support";

// Nav sections each role can access
const ROLE_NAV: Record<AdminRole, string[]> = {
  admin:      ["/admin", "/admin/discovery", "/admin/approvals", "/admin/deals", "/admin/deliverables", "/admin/review", "/admin/settings"],
  management: ["/admin", "/admin/approvals", "/admin/deals"],
  support:    ["/admin", "/admin/discovery", "/admin/approvals", "/admin/deals", "/admin/deliverables", "/admin/review"],
};

export function getAllowedNav(role: string): string[] {
  return ROLE_NAV[role as AdminRole] ?? [];
}

export function canAccess(role: string, href: string): boolean {
  const allowed = getAllowedNav(role);
  if (allowed.length === 0) return false;
  if (href === "/admin") return allowed.includes("/admin");
  return allowed.some(a => a !== "/admin" && href.startsWith(a));
}

/** Whether this role can see financial rates and fees */
export function canViewRates(role: string): boolean {
  return role !== "support";
}

// Roles that can enter the /admin section
export const ADMIN_ROLES: string[] = ["admin", "management", "support"];

// Roles that can be assigned in the Settings UI
export const ASSIGNABLE_ROLES: string[] = ["admin", "management", "support", "editor", "influencer", "agency"];

export const ROLE_LABELS: Record<string, string> = {
  admin:      "Admin",
  management: "Management",
  support:    "Support",
  editor:     "Editor",
  influencer: "Influencer",
  agency:     "Agency",
};

export const ROLE_COLORS: Record<string, string> = {
  admin:      "bg-im8-burgundy text-white",
  management: "bg-purple-100 text-purple-700",
  support:    "bg-gray-100 text-gray-700",
  editor:     "bg-yellow-100 text-yellow-700",
  influencer: "bg-blue-100 text-blue-700",
  agency:     "bg-teal-100 text-teal-700",
};
