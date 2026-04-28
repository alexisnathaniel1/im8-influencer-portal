import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  const [
    { count: newProfiles },
    { count: shortlisted },
    { count: pendingApproval },
    { count: pendingReview },
    { count: activeDeals },
  ] = await Promise.all([
    admin.from("discovery_profiles").select("*", { count: "exact", head: true }).eq("status", "new"),
    admin.from("discovery_profiles").select("*", { count: "exact", head: true }).eq("status", "shortlisted"),
    admin.from("deals").select("*", { count: "exact", head: true }).eq("status", "pending_approval"),
    admin.from("submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("deals").select("*", { count: "exact", head: true }).in("status", ["live", "contracted"]),
  ]);

  const stats = [
    { label: "New profiles",       value: newProfiles     ?? 0, href: "/admin/discovery?status=new" },
    { label: "Shortlisted",        value: shortlisted     ?? 0, href: "/admin/discovery?status=shortlisted" },
    { label: "Pending approval",   value: pendingApproval ?? 0, href: "/admin/approvals" },
    { label: "Content to review",  value: pendingReview   ?? 0, href: "/admin/review" },
    { label: "Active partnerships",value: activeDeals     ?? 0, href: "/admin/deals?status=active" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-[40px] leading-tight font-bold text-im8-maroon">Dashboard</h1>
        <p className="text-im8-muted mt-1 text-[14px]">IM8 Influencer Marketing overview</p>
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(s => (
          <Link
            key={s.label}
            href={s.href}
            className="group bg-white rounded-xl border border-im8-stone/30 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-im8-stone/50"
          >
            <div className="text-[32px] font-bold text-im8-gold leading-none">{s.value}</div>
            <div className="text-[11px] text-im8-muted uppercase tracking-[0.08em] mt-2 font-medium">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions + pipeline */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-im8-stone/30 p-6">
          <h2 className="text-[13px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-4">Quick actions</h2>
          <div className="space-y-2.5">
            {[
              { href: "/admin/discovery", label: "Review new discovery profiles" },
              { href: "/admin/approvals", label: "Send deals for approval" },
              { href: "/admin/review",    label: "Review pending content" },
              { href: "/intake",          label: "Share intake form link ↗", external: true },
            ].map(({ href, label, external }) => (
              <Link
                key={href}
                href={href}
                target={external ? "_blank" : undefined}
                className="flex items-center gap-2 text-[13px] text-im8-maroon hover:text-im8-red transition-colors group"
              >
                <span className="text-im8-red group-hover:translate-x-0.5 transition-transform">→</span>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-im8-stone/30 p-6">
          <h2 className="text-[13px] font-bold text-im8-muted uppercase tracking-[0.1em] mb-4">Pipeline stages</h2>
          <div className="space-y-3">
            {[
              ["Discovery → Shortlisted",  "Review new profiles"],
              ["Shortlisted → Agreed",     "Log negotiation outcome"],
              ["Agreed → Approved",        "Send for management approval"],
              ["Approved → Live",          "Brief, onboard influencer"],
              ["Live → Completed",         "Content review, go-live tracking"],
            ].map(([stage, action]) => (
              <div key={stage} className="flex items-center justify-between gap-4">
                <span className="text-[13px] font-medium text-im8-maroon">{stage}</span>
                <span className="text-[11px] text-im8-muted shrink-0">{action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
