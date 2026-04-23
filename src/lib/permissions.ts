export type AdminRole = "owner" | "admin" | "ops" | "management" | "influencer_team" | "finance" | "support";

// Nav sections each role can access
const ROLE_NAV: Record<AdminRole, string[]> = {
  owner:           ["/admin", "/admin/discovery", "/admin/approvals", "/admin/deals", "/admin/deliverables", "/admin/review", "/admin/settings"],
  admin:           ["/admin", "/admin/discovery", "/admin/approvals", "/admin/deals", "/admin/deliverables", "/admin/review", "/admin/settings"],
  ops:             ["/admin", "/admin/discovery", "/admin/approvals", "/admin/deals", "/admin/deliverables", "/admin/review", "/admin/settings"],
  management:      ["/admin", "/admin/approvals", "/admin/deals"],
  influencer_team: ["/admin", "/admin/discovery", "/admin/deals", "/admin/deliverables", "/admin/review"],
  finance:         ["/admin", "/admin/deals"],
  support:         ["/admin", "/admin/discovery", "/admin/approvals", "/admin/deals", "/admin/deliverables", "/admin/review"],
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

// Roles that are allowed into the /admin section at all
export const ADMIN_ROLES: string[] = ["owner", "admin", "ops", "management", "influencer_team", "finance", "support"];

// Roles assignable via the settings page
export const ASSIGNABLE_ROLES: string[] = ["owner", "admin", "ops", "management", "influencer_team", "finance", "support", "approver", "editor"];

export const ROLE_LABELS: Record<string, string> = {
  owner:           "Owner",
  admin:           "Admin",
  ops:             "Ops",
  management:      "Management",
  influencer_team: "Influencer Team",
  finance:         "Finance",
  support:         "Support",
  approver:        "Approver",
  editor:          "Editor",
  influencer:      "Influencer",
  agency:          "Agency",
};

export const ROLE_COLORS: Record<string, string> = {
  owner:           "bg-im8-burgundy text-white",
  admin:           "bg-im8-red text-white",
  ops:             "bg-orange-100 text-orange-700",
  management:      "bg-purple-100 text-purple-700",
  influencer_team: "bg-blue-100 text-blue-700",
  finance:         "bg-teal-100 text-teal-700",
  support:         "bg-gray-100 text-gray-700",
  approver:        "bg-green-100 text-green-700",
  editor:          "bg-yellow-100 text-yellow-700",
};
