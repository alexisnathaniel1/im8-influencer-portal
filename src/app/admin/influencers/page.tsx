import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function InfluencersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: influencers } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, created_at")
    .eq("role", "influencer")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/admin" className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-im8-burgundy">Influencers</h1>
          <p className="text-sm text-im8-burgundy/60">{influencers?.length ?? 0} portal accounts</p>
        </div>

        <div className="bg-white rounded-xl border border-im8-stone/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-im8-offwhite border-b border-im8-sand">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-im8-burgundy/60 uppercase tracking-wide">Joined</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-im8-sand/50">
              {(influencers ?? []).map((inf) => (
                <tr key={inf.id} className="hover:bg-im8-offwhite/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-im8-burgundy">{inf.full_name || "—"}</td>
                  <td className="px-6 py-4 text-im8-burgundy/70">{inf.email}</td>
                  <td className="px-6 py-4 text-im8-burgundy/50">{new Date(inf.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/influencers/${inf.id}`} className="text-im8-red hover:underline text-sm">View</Link>
                  </td>
                </tr>
              ))}
              {(!influencers || influencers.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-im8-burgundy/50">No influencer accounts yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
