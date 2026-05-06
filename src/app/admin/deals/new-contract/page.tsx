import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NewContractForm from "./new-contract-form";
import { canViewRates } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Deliverable = { code: string; count: number };

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const sourceId = params.from;

  if (!sourceId) {
    redirect("/admin/deals");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const showRates = canViewRates((profile as { role?: string } | null)?.role ?? "");

  const admin = createAdminClient();

  // Load the source deal
  const { data: source } = await admin
    .from("deals")
    .select(`
      id, influencer_name, influencer_email, agency_name, platform_primary,
      instagram_handle, tiktok_handle, youtube_handle, follower_count,
      niche_tags, deliverables, monthly_rate_cents, total_months,
      contract_sequence, influencer_profile_id
    `)
    .eq("id", sourceId)
    .single();

  if (!source) {
    return (
      <div className="max-w-xl animate-fade-in">
        <h1 className="text-2xl font-bold text-im8-burgundy mb-4">Source partnership not found</h1>
        <p className="text-im8-burgundy/60 mb-6">
          We couldn't find the partnership you're starting a new contract from. It may have been deleted.
        </p>
        <Link href="/admin/deals" className="text-im8-red hover:underline">
          ← Back to Partner Tracker
        </Link>
      </div>
    );
  }

  // Compute the next contract number (for display before the form submits)
  let nextSeq = (source.contract_sequence ?? 0) + 1;
  if (source.influencer_profile_id) {
    const { data: maxRows } = await admin
      .from("deals")
      .select("contract_sequence")
      .eq("influencer_profile_id", source.influencer_profile_id)
      .order("contract_sequence", { ascending: false })
      .limit(1);
    if (maxRows && maxRows.length > 0) {
      nextSeq = (maxRows[0].contract_sequence ?? 0) + 1;
    }
  }

  const sourceDeliverables = (source.deliverables as Deliverable[] | null) ?? [];
  // Only pass the previous rate to the form if the viewer is management — others
  // shouldn't see what the historical rate was, even when renewing.
  const sourceRateUsd = showRates && source.monthly_rate_cents ? source.monthly_rate_cents / 100 : null;

  return (
    <div className="max-w-2xl animate-fade-in space-y-6">
      <div>
        <Link
          href={`/admin/deals/${source.id}`}
          className="text-xs text-im8-burgundy/60 hover:text-im8-red"
        >
          ← Back to Contract {source.contract_sequence ?? 1}
        </Link>
        <h1 className="text-2xl font-bold text-im8-burgundy mt-2">
          New contract — {source.influencer_name}
        </h1>
        <p className="text-sm text-im8-burgundy/60 mt-1">
          This will create <strong>Contract {nextSeq}</strong> linked to the prior contract.
          Goes straight to the Approvals queue — Discovery is skipped.
        </p>
      </div>

      {/* Read-only creator identity */}
      <div className="bg-im8-sand/50 border border-im8-stone/30 rounded-xl p-5 space-y-2">
        <div className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide">
          Partner (inherited from previous contract)
        </div>
        <div className="text-sm text-im8-burgundy">
          <div className="font-semibold">{source.influencer_name}</div>
          {source.agency_name && <div className="text-im8-burgundy/60">via {source.agency_name}</div>}
          <div className="text-im8-burgundy/60 capitalize mt-1">Platform: {source.platform_primary}</div>
          {source.instagram_handle && <div className="text-xs text-im8-burgundy/60">IG: @{source.instagram_handle}</div>}
          {source.tiktok_handle && <div className="text-xs text-im8-burgundy/60">TikTok: @{source.tiktok_handle}</div>}
          {source.youtube_handle && <div className="text-xs text-im8-burgundy/60">YT: @{source.youtube_handle}</div>}
        </div>
      </div>

      <NewContractForm
        sourceDealId={source.id}
        nextSequence={nextSeq}
        initialRateUsd={sourceRateUsd}
        initialMonths={source.total_months ?? 3}
        initialDeliverables={sourceDeliverables.filter(d => d.code !== "WHITELIST")}
        canViewRates={showRates}
      />
    </div>
  );
}
