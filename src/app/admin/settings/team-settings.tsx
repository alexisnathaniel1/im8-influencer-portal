"use client";

import { useState } from "react";
import { ASSIGNABLE_ROLES, ROLE_COLORS, ROLE_LABELS } from "@/lib/permissions";

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface FoundUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  isStaff: boolean;
}

export default function TeamSettings({ members, currentRole }: { members: Member[]; currentRole: string }) {
  const [team, setTeam] = useState<Member[]>(members);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = currentRole === "owner" || currentRole === "admin";

  // User lookup state
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [assignRole, setAssignRole] = useState("influencer_team");
  const [assigning, setAssigning] = useState(false);

  async function changeRole(userId: string, newRole: string) {
    setSaving(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update role");
        return;
      }
      setTeam(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m));
    } finally {
      setSaving(null);
    }
  }

  async function lookupUser(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupEmail.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setFoundUser(null);
    try {
      const res = await fetch(`/api/admin/users/find?email=${encodeURIComponent(lookupEmail.trim())}`);
      const data = await res.json();
      if (!res.ok) { setLookupError(data.error ?? "Not found"); return; }
      setFoundUser(data);
      setAssignRole(data.role);
    } finally {
      setLookupLoading(false);
    }
  }

  async function assignToUser() {
    if (!foundUser) return;
    setAssigning(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/admin/roles/${foundUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: assignRole }),
      });
      const data = await res.json();
      if (!res.ok) { setLookupError(data.error ?? "Failed"); return; }
      const updated = { ...foundUser, role: assignRole };
      setFoundUser(updated);
      // Update in-table member if they're already listed
      setTeam(prev => {
        const exists = prev.find(m => m.id === foundUser.id);
        if (exists) return prev.map(m => m.id === foundUser.id ? { ...m, role: assignRole } : m);
        // Add to table if they're now a staff role
        if (ASSIGNABLE_ROLES.includes(assignRole)) {
          return [...prev, { id: foundUser.id, full_name: foundUser.full_name, email: foundUser.email, role: assignRole, created_at: new Date().toISOString() }];
        }
        return prev;
      });
      setLookupEmail("");
      setFoundUser(null);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Assign role to any user */}
      {canEdit && (
        <div className="bg-white rounded-xl border border-im8-stone/20 p-6">
          <h2 className="text-base font-semibold text-im8-burgundy mb-1">Assign role</h2>
          <p className="text-xs text-im8-burgundy/50 mb-4">Look up any user by email and give them a portal role.</p>

          <form onSubmit={lookupUser} className="flex gap-2 mb-4">
            <input
              type="email"
              value={lookupEmail}
              onChange={e => setLookupEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
            />
            <button
              type="submit"
              disabled={lookupLoading || !lookupEmail.trim()}
              className="px-4 py-2 bg-im8-burgundy text-white text-sm rounded-lg hover:bg-im8-red transition-colors disabled:opacity-50"
            >
              {lookupLoading ? "Finding…" : "Find"}
            </button>
          </form>

          {lookupError && (
            <p className="text-sm text-red-600 mb-3">{lookupError}</p>
          )}

          {foundUser && (
            <div className="flex items-center gap-4 p-4 bg-im8-sand/40 rounded-xl border border-im8-stone/20">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-im8-burgundy text-sm">{foundUser.full_name || foundUser.email}</div>
                <div className="text-xs text-im8-burgundy/50">{foundUser.email}</div>
                <div className="mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${ROLE_COLORS[foundUser.role] ?? "bg-gray-100 text-gray-600"}`}>
                    Current: {ROLE_LABELS[foundUser.role] ?? foundUser.role}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={assignRole}
                  onChange={e => setAssignRole(e.target.value)}
                  className="text-sm border border-im8-stone/30 rounded-lg px-3 py-1.5 text-im8-burgundy bg-white focus:outline-none focus:ring-1 focus:ring-im8-red"
                >
                  {ASSIGNABLE_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button
                  onClick={assignToUser}
                  disabled={assigning || assignRole === foundUser.role}
                  className="px-4 py-1.5 bg-im8-red text-white text-sm rounded-lg hover:bg-im8-burgundy transition-colors disabled:opacity-50"
                >
                  {assigning ? "Saving…" : "Assign"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team table */}
      <div className="bg-white rounded-xl border border-im8-stone/20 p-6">
        <h2 className="text-base font-semibold text-im8-burgundy mb-4">Team Members</h2>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-im8-sand">
              <tr>
                <th className="text-left pb-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Name</th>
                <th className="text-left pb-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Email</th>
                <th className="text-left pb-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Role</th>
                <th className="text-left pb-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Joined</th>
                {canEdit && <th className="pb-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-im8-sand/50">
              {team.map((member) => (
                <tr key={member.id}>
                  <td className="py-3 font-medium text-im8-burgundy">{member.full_name || "—"}</td>
                  <td className="py-3 text-im8-burgundy/70">{member.email}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[member.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  </td>
                  <td className="py-3 text-im8-burgundy/50">{new Date(member.created_at).toLocaleDateString()}</td>
                  {canEdit && (
                    <td className="py-3 text-right">
                      <select
                        value={member.role}
                        disabled={saving === member.id}
                        onChange={e => changeRole(member.id, e.target.value)}
                        className="text-xs border border-im8-stone/30 rounded px-2 py-1 text-im8-burgundy bg-white focus:outline-none focus:ring-1 focus:ring-im8-red disabled:opacity-50"
                      >
                        {ASSIGNABLE_ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
              {team.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="py-8 text-center text-im8-burgundy/40 text-sm">
                    No team members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!canEdit && (
          <p className="text-xs text-im8-burgundy/40 mt-4">Only Owner and Admin roles can change team member roles.</p>
        )}
      </div>

      {/* Role reference */}
      <div className="bg-white rounded-xl border border-im8-stone/20 p-6">
        <h2 className="text-base font-semibold text-im8-burgundy mb-3">Role permissions</h2>
        <div className="grid grid-cols-1 gap-3 text-sm">
          {[
            { role: "Owner", access: "Full access to everything including role management" },
            { role: "Admin", access: "Full access to all sections" },
            { role: "Ops", access: "Dashboard, Discovery, Approvals, Partner Tracker, Deliverables, Content Review, Settings" },
            { role: "Management", access: "Dashboard, Approvals, Partner Tracker — can see rates" },
            { role: "Influencer Team", access: "Dashboard, Discovery, Partner Tracker, Deliverables, Content Review — can see rates" },
            { role: "Finance", access: "Dashboard, Partner Tracker — can see rates" },
            { role: "Support", access: "Dashboard, Discovery, Approvals, Partner Tracker, Deliverables, Content Review — rates hidden" },
            { role: "Approver", access: "Approval portal only (separate login at /approver)" },
            { role: "Editor", access: "Editor portal only (separate login at /editor)" },
          ].map(({ role, access }) => (
            <div key={role} className="flex gap-3">
              <span className="font-medium text-im8-burgundy w-36 shrink-0">{role}</span>
              <span className="text-im8-burgundy/60">{access}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
