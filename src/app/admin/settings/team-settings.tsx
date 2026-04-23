"use client";

import { useState } from "react";
import { STAFF_ASSIGNABLE_ROLES, ROLE_COLORS, ROLE_LABELS } from "@/lib/permissions";

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
  const [team, setTeam] = useState<Member[]>(members.filter(m => m.role !== "pending"));
  const [pending, setPending] = useState<Member[]>(members.filter(m => m.role === "pending"));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = currentRole === "admin";

  // Activation role for each pending user
  const [activateRoles, setActivateRoles] = useState<Record<string, string>>(
    Object.fromEntries(members.filter(m => m.role === "pending").map(m => [m.id, "support"]))
  );

  // User lookup state
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [assignRole, setAssignRole] = useState("support");
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

  async function activatePending(member: Member) {
    const newRole = activateRoles[member.id] ?? "support";
    setSaving(member.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to activate");
        return;
      }
      // Move from pending to team
      setPending(prev => prev.filter(m => m.id !== member.id));
      setTeam(prev => [...prev, { ...member, role: newRole }]);
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
      setAssignRole(STAFF_ASSIGNABLE_ROLES.includes(data.role) ? data.role : "support");
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
      setTeam(prev => {
        const exists = prev.find(m => m.id === foundUser.id);
        if (exists) return prev.map(m => m.id === foundUser.id ? { ...m, role: assignRole } : m);
        if (STAFF_ASSIGNABLE_ROLES.includes(assignRole)) {
          return [...prev, { id: foundUser.id, full_name: foundUser.full_name, email: foundUser.email, role: assignRole, created_at: new Date().toISOString() }];
        }
        return prev;
      });
      // Remove from pending list if they were pending
      setPending(prev => prev.filter(m => m.id !== foundUser.id));
      setLookupEmail("");
      setFoundUser(null);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending activation */}
      {canEdit && pending.length > 0 && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
          <h2 className="text-base font-semibold text-orange-800 mb-1">Pending Activation</h2>
          <p className="text-xs text-orange-700/70 mb-4">
            These users signed up with a staff email domain. Assign them a role to grant access.
          </p>
          <div className="space-y-3">
            {pending.map(member => (
              <div key={member.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-orange-200">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-im8-burgundy text-sm">{member.full_name || "—"}</div>
                  <div className="text-xs text-im8-burgundy/50">{member.email}</div>
                  <div className="text-xs text-im8-burgundy/40 mt-0.5">
                    Signed up {new Date(member.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={activateRoles[member.id] ?? "support"}
                    onChange={e => setActivateRoles(prev => ({ ...prev, [member.id]: e.target.value }))}
                    className="text-sm border border-im8-stone/30 rounded-lg px-3 py-1.5 text-im8-burgundy bg-white focus:outline-none focus:ring-1 focus:ring-im8-red"
                  >
                    {STAFF_ASSIGNABLE_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => activatePending(member)}
                    disabled={saving === member.id}
                    className="px-4 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {saving === member.id ? "Activating…" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign role to any user */}
      {canEdit && (
        <div className="bg-white rounded-xl border border-im8-stone/20 p-6">
          <h2 className="text-base font-semibold text-im8-burgundy mb-1">Assign role</h2>
          <p className="text-xs text-im8-burgundy/50 mb-4">Look up any signed-up user by email and give them a staff role.</p>

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
                  {STAFF_ASSIGNABLE_ROLES.map(r => (
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
                        {STAFF_ASSIGNABLE_ROLES.map(r => (
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
          <p className="text-xs text-im8-burgundy/40 mt-4">Only Admins can change team member roles.</p>
        )}
      </div>

      {/* Role reference */}
      <div className="bg-white rounded-xl border border-im8-stone/20 p-6">
        <h2 className="text-base font-semibold text-im8-burgundy mb-3">Role permissions</h2>
        <div className="grid grid-cols-1 gap-3 text-sm">
          {[
            { role: "Admin", access: "Full access to all sections and role management" },
            { role: "Management", access: "Dashboard, Approvals, Partner Tracker — can see rates" },
            { role: "Support", access: "Dashboard, Discovery, Approvals, Partner Tracker, Deliverables, Content Review — rates hidden" },
            { role: "Editor", access: "Editor portal only — sees assigned deliverables to upload edited videos" },
            { role: "Influencer / Agency", access: "Partner portal — submit, track own deals and deliverables" },
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
