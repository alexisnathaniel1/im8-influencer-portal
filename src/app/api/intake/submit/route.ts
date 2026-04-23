import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { scoreProfile } from "@/lib/ai/profile-score";
import { appendIntakeHistory } from "@/lib/google/sheets";

interface ProposedDeliverable {
  code: string;
  count: number;
}

interface InfluencerEntry {
  influencerName: string;
  platformPrimary: string;
  igHandle: string;
  tiktokHandle: string;
  youtubeHandle: string;
  followerCount: string;
  proposedRate: string;
  totalMonths?: number;
  positioning: string;
  niche: string[];
  othersNiche: string;
  proposedDeliverables: ProposedDeliverable[];
}

async function isDuplicate(
  supabase: ReturnType<typeof createAdminClient>,
  inf: InfluencerEntry,
  agencyName: string | null,
): Promise<boolean> {
  const handleChecks: Array<{ col: string; val: string }> = [];
  if (inf.igHandle?.trim()) handleChecks.push({ col: "instagram_handle", val: inf.igHandle.trim().replace(/^@/, "") });
  if (inf.tiktokHandle?.trim()) handleChecks.push({ col: "tiktok_handle", val: inf.tiktokHandle.trim().replace(/^@/, "") });
  if (inf.youtubeHandle?.trim()) handleChecks.push({ col: "youtube_handle", val: inf.youtubeHandle.trim().replace(/^@/, "") });

  for (const { col, val } of handleChecks) {
    const { count } = await supabase
      .from("discovery_profiles")
      .select("*", { count: "exact", head: true })
      .ilike(col, val);
    if ((count ?? 0) > 0) return true;
  }

  if (inf.influencerName?.trim() && agencyName) {
    const { count } = await supabase
      .from("discovery_profiles")
      .select("*", { count: "exact", head: true })
      .ilike("influencer_name", inf.influencerName.trim())
      .ilike("agency_name", agencyName.trim());
    if ((count ?? 0) > 0) return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Require auth — agencies/creators must sign up first
    const supabaseCookie = await createClient();
    const { data: { user } } = await supabaseCookie.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const formData = await request.formData();

    const submitterName = formData.get("submitterName") as string;
    const submitterEmail = formData.get("submitterEmail") as string;
    const submitterAgency = (formData.get("submitterAgency") as string) || null;
    const influencersRaw = formData.get("influencers") as string;

    if (!submitterEmail || !influencersRaw) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const influencers: InfluencerEntry[] = JSON.parse(influencersRaw);
    if (!influencers.length) {
      return NextResponse.json({ error: "No influencers provided" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Determine source — maps to discovery_source enum ('manual' | 'intake_form' | 'agency_email')
    const { data: submitterProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const isAdminUser = ["admin", "management", "support"].includes(submitterProfile?.role ?? "");
    const requestedSource = (formData.get("source") as string) || "inbound_form";
    const source: "manual" | "intake_form" | "agency_email" = (isAdminUser && requestedSource === "admin_manual") ? "manual" : "intake_form";
    const inserted: Array<{ id: string; name: string; data: InfluencerEntry }> = [];
    const duplicates: string[] = [];
    const errors: Array<{ name: string; error: string }> = [];

    for (const inf of influencers) {
      if (!inf.influencerName?.trim()) continue;

      const dup = await isDuplicate(supabase, inf, submitterAgency);
      if (dup) {
        duplicates.push(inf.influencerName);
        continue;
      }

      const igHandle = inf.igHandle?.trim().replace(/^@/, "") || null;
      const tiktokHandle = inf.tiktokHandle?.trim().replace(/^@/, "") || null;
      const youtubeHandle = inf.youtubeHandle?.trim().replace(/^@/, "") || null;

      const { data: profile, error } = await supabase
        .from("discovery_profiles")
        .insert({
          source,
          status: "new",
          submitter_name: submitterName,
          submitter_email: submitterEmail,
          submitted_by_profile_id: user.id,
          agency_name: submitterAgency,
          influencer_name: inf.influencerName.trim(),
          instagram_handle: igHandle,
          tiktok_handle: tiktokHandle,
          youtube_handle: youtubeHandle,
          platform_primary: inf.platformPrimary || "instagram",
          follower_count: inf.followerCount ? parseInt(inf.followerCount) : null,
          proposed_rate_cents: inf.proposedRate ? Math.round(parseFloat(inf.proposedRate) * 100) : null,
          niche_tags: inf.niche ?? [],
          others_niche: inf.niche.includes("Others") ? (inf.othersNiche || null) : null,
          positioning: inf.positioning?.trim() || null,
          proposed_deliverables: inf.proposedDeliverables ?? [],
          total_months: inf.totalMonths && inf.totalMonths > 0 ? inf.totalMonths : 3,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[intake/submit] Insert error:", error.message, error.details, error.hint);
        errors.push({ name: inf.influencerName, error: error.message });
        continue;
      }

      if (profile) inserted.push({ id: profile.id, name: inf.influencerName, data: inf });
    }

    // Append each insert to the Intake History sheet (best-effort; non-blocking)
    after(async () => {
      for (const row of inserted) {
        try {
          await appendIntakeHistory({
            submitterName,
            submitterEmail,
            submitterAgency,
            influencerName: row.name,
            platform: row.data.platformPrimary,
            igHandle: row.data.igHandle,
            tiktokHandle: row.data.tiktokHandle,
            youtubeHandle: row.data.youtubeHandle,
            followerCount: row.data.followerCount ? parseInt(row.data.followerCount) : null,
            proposedRateUsd: row.data.proposedRate ? parseFloat(row.data.proposedRate) : null,
            niches: row.data.niche,
            othersNiche: row.data.othersNiche || null,
            positioning: row.data.positioning || null,
            proposedDeliverables: row.data.proposedDeliverables,
            discoveryProfileId: row.id,
          });
        } catch (err) {
          console.error("[intake/submit] Sheets append failed:", err);
        }
      }
    });

    // AI scoring for each inserted profile in background
    after(async () => {
      for (const { id, data } of inserted) {
        const score = await scoreProfile({
          influencerName: data.influencerName,
          platform: data.platformPrimary,
          igHandle: data.igHandle?.trim().replace(/^@/, "") || null,
          tiktokHandle: data.tiktokHandle?.trim().replace(/^@/, "") || null,
          youtubeHandle: data.youtubeHandle?.trim().replace(/^@/, "") || null,
          followerCount: data.followerCount ? parseInt(data.followerCount) : null,
          niche: data.niche,
          proposedRateUsd: data.proposedRate ? parseFloat(data.proposedRate) : null,
          portfolioLinks: [],
          agencyName: submitterAgency,
          pitchSummary: data.positioning || null,
        });

        if (score) {
          await supabase.from("discovery_profiles").update({
            ai_score: score.score,
            ai_summary: score.summary,
            ai_red_flags: score.red_flags,
            niche_tags: score.niche_tags,
            ai_scored_at: new Date().toISOString(),
          }).eq("id", id);
        }
      }
    });

    return NextResponse.json({
      success: true,
      submitted: inserted.length,
      duplicates: duplicates.length,
      duplicateNames: duplicates,
      insertErrors: errors,
    });
  } catch (err) {
    console.error("[intake/submit]", err);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
