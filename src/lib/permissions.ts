export type AdminRole = "admin" | "management" | "support";

// Nav sections each role can access
const ROLE_NAV: Record<AdminRole, string[]> = {
  admin:      ["/admin", "/admin/workflow", "/admin/discovery", "/admin/approvals", "/admin/deals", "/admin/roster", "/admin/deliverables", "/admin/calendar", "/admin/review", "/admin/review/history", "/admin/inbox", "/admin/settings"],
  management: ["/admin", "/admin/workflow", "/admin/discovery", "/admin/approvals", "/admin/deals", "/admin/roster", "/admin/deliverables", "/admin/calendar", "/admin/review", "/admin/review/history", "/admin/inbox", "/admin/settings"],
  support:    ["/admin", "/admin/workflow", "/admin/deals", "/admin/roster", "/admin/deliverables", "/admin/calendar", "/admin/review", "/admin/review/history", "/admin/inbox"],
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

/** Whether this role can see financial rates and fees — management only */
export function canViewRates(role: string): boolean {
  return role === "management";
}

// Roles that can enter the /admin section
export const ADMIN_ROLES: string[] = ["admin", "management", "support"];

// All roles allowed via the PATCH /api/admin/roles endpoint (includes partner roles for validation)
export const ASSIGNABLE_ROLES: string[] = ["admin", "management", "support", "editor", "influencer", "agency"];

// Roles shown in the Settings → Team dropdowns (partner roles not managed from admin side)
export const STAFF_ASSIGNABLE_ROLES: string[] = ["admin", "management", "support", "editor"];

export const ROLE_LABELS: Record<string, string> = {
  admin:      "Admin",
  management: "Management",
  support:    "Support",
  editor:     "Editor",
  influencer: "Influencer",
  agency:     "Agency",
  pending:    "Pending Activation",
};

export const ROLE_COLORS: Record<string, string> = {
  admin:      "bg-im8-burgundy text-white",
  management: "bg-purple-100 text-purple-700",
  support:    "bg-gray-100 text-gray-700",
  editor:     "bg-yellow-100 text-yellow-700",
  influencer: "bg-blue-100 text-blue-700",
  agency:     "bg-teal-100 text-teal-700",
  pending:    "bg-orange-100 text-orange-700",
};
