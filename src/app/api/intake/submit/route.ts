import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { scoreProfile } from "@/lib/ai/profile-score";

interface InfluencerEntry {
  influencerName: string;
  platformPrimary: string;
  igHandle: string;
  tiktokHandle: string;
  youtubeHandle: string;
  followerCount: string;
  proposedRate: string;
  portfolioLinks: string;
  niche: string[];
  notes: string;
}

async function isDuplicate(
  supabase: ReturnType<typeof createAdminClient>,
  inf: InfluencerEntry,
  agencyName: string | null,
): Promise<boolean> {
  // Check by handle (most reliable — same person on same platform)
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

  // Fallback: same name + same agency (case-insensitive)
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
    const inserted: Array<{ id: string; name: string }> = [];
    const duplicates: string[] = [];

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
          source: "inbound_form",
          status: "new",
          submitter_name: submitterName,
          submitter_email: submitterEmail,
          agency_name: submitterAgency,
          influencer_name: inf.influencerName.trim(),
          instagram_handle: igHandle,
          tiktok_handle: tiktokHandle,
          youtube_handle: youtubeHandle,
          platform_primary: inf.platformPrimary || "instagram",
          follower_count: inf.followerCount ? parseInt(inf.followerCount) : null,
          proposed_rate_cents: inf.proposedRate ? Math.round(parseFloat(inf.proposedRate) * 100) : null,
          portfolio_url: inf.portfolioLinks || null,
          niche_tags: inf.niche ?? [],
          notes: inf.notes || null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[intake/submit] Insert error:", error.message);
        continue;
      }

      if (profile) inserted.push({ id: profile.id, name: inf.influencerName });
    }

    // AI scoring for each inserted profile in background
    after(async () => {
      for (const { id, name } of inserted) {
        const inf = influencers.find(i => i.influencerName === name)!;
        const score = await scoreProfile({
          influencerName: name,
          platform: inf.platformPrimary,
          igHandle: inf.igHandle?.trim().replace(/^@/, "") || null,
          tiktokHandle: inf.tiktokHandle?.trim().replace(/^@/, "") || null,
          youtubeHandle: inf.youtubeHandle?.trim().replace(/^@/, "") || null,
          followerCount: inf.followerCount ? parseInt(inf.followerCount) : null,
          niche: inf.niche,
          proposedRateUsd: inf.proposedRate ? parseFloat(inf.proposedRate) : null,
          portfolioLinks: inf.portfolioLinks
            ? inf.portfolioLinks.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
            : [],
          agencyName: submitterAgency,
          pitchSummary: inf.notes || null,
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
    });
  } catch (err) {
    console.error("[intake/submit]", err);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
