import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import DiscoveryProfileClient from "./profile-client";

export default async function DiscoveryProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("discovery_profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  // Check if a deal already exists for this profile
  const { data: existingDeal } = await admin
    .from("deals")
    .select("id")
    .eq("discovery_profile_id", id)
    .maybeSingle();

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/discovery" className="text-im8-burgundy/50 hover:text-im8-burgundy text-sm">← Discovery</Link>
        <span className="text-im8-burgundy/30">/</span>
        <h1 className="text-2xl font-bold text-im8-burgundy">{profile.influencer_name}</h1>
      </div>

      <DiscoveryProfileClient profile={profile} existingDealId={existingDeal?.id ?? null} />
    </div>
  );
}
