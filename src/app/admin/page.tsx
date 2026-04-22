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
    { label: "New profiles", value: newProfiles ?? 0, href: "/admin/discovery?status=new", color: "bg-im8-sand" },
    { label: "Shortlisted", value: shortlisted ?? 0, href: "/admin/discovery?status=shortlisted", color: "bg-im8-flamingo/30" },
    { label: "Pending approval", value: pendingApproval ?? 0, href: "/admin/approvals", color: "bg-yellow-50" },
    { label: "Content to review", value: pendingReview ?? 0, href: "/admin/review", color: "bg-blue-50" },
    { label: "Active partnerships", value: activeDeals ?? 0, href: "/admin/deals?status=live", color: "bg-green-50" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">Dashboard</h1>
        <p className="text-im8-burgundy/60 mt-1">IM8 Influencer Marketing overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href}
            className={`${s.color} rounded-xl p-5 border border-im8-stone/30 hover:shadow-md transition-shadow`}>
            <div className="text-3xl font-bold text-im8-burgundy">{s.value}</div>
            <div className="text-sm text-im8-burgundy/60 mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-im8-stone/30 p-6">
          <h2 className="font-semibold text-im8-burgundy mb-4">Quick actions</h2>
          <div className="space-y-2">
            <Link href="/admin/discovery" className="flex items-center gap-2 text-sm text-im8-red hover:underline">
              → Review new discovery profiles
            </Link>
            <Link href="/admin/approvals" className="flex items-center gap-2 text-sm text-im8-red hover:underline">
              → Send deals for approval
            </Link>
            <Link href="/admin/review" className="flex items-center gap-2 text-sm text-im8-red hover:underline">
              → Review pending content
            </Link>
            <Link href="/intake" target="_blank" className="flex items-center gap-2 text-sm text-im8-red hover:underline">
              → Share intake form link ↗
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-im8-stone/30 p-6">
          <h2 className="font-semibold text-im8-burgundy mb-4">Pipeline stages</h2>
          <div className="space-y-2 text-sm">
            {[
              ["Discovery → Shortlisted", "Review new profiles"],
              ["Shortlisted → Agreed", "Log negotiation outcome"],
              ["Agreed → Approved", "Send for management approval"],
              ["Approved → Live", "Send brief, onboard influencer"],
              ["Live → Completed", "Review content, go-live tracking"],
            ].map(([stage, action]) => (
              <div key={stage} className="flex justify-between text-im8-burgundy/70">
                <span className="font-medium text-im8-burgundy">{stage}</span>
                <span className="text-xs">{action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
