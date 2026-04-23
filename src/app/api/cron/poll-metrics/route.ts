import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";

// Called by Vercel cron — secured by CRON_SECRET header
export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch non-story deliverables with a post URL that need metrics refresh
  const { data: stale } = await admin
    .from("deliverables")
    .select("id, post_url, deliverable_type, platform, deal:deal_id(influencer_name)")
    .eq("is_story", false)
    .not("post_url", "is", null)
    .or(`views_updated_at.is.null,views_updated_at.lt.${cutoff}`)
    .in("status", ["live", "completed"]);

  let updated = 0;

  for (const d of stale ?? []) {
    try {
      const metrics = await fetchMetrics(d.platform, d.post_url!);
      if (metrics) {
        await admin.from("deliverables").update({
          views: metrics.views ?? null,
          likes: metrics.likes ?? null,
          comments_count: metrics.comments ?? null,
          views_updated_at: new Date().toISOString(),
        }).eq("id", d.id);
        updated++;
      }
    } catch (err) {
      console.error(`[poll-metrics] Failed for ${d.id}:`, err);
    }
  }

  // Daily PIC digest
  await sendPicDigests(admin);

  return NextResponse.json({ polled: stale?.length ?? 0, updated });
}

async function fetchMetrics(
  platform: string,
  postUrl: string,
): Promise<{ views?: number; likes?: number; comments?: number } | null> {
  // Instagram Graph API
  if (platform === "instagram" && process.env.IG_GRAPH_ACCESS_TOKEN) {
    try {
      // Extract media ID from URL — IG shortcodes need conversion via oEmbed
      const oembedRes = await fetch(
        `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&access_token=${process.env.IG_GRAPH_ACCESS_TOKEN}`
      );
      if (!oembedRes.ok) return null;
      const oembed = await oembedRes.json();
      const mediaId: string | undefined = oembed.media_id;
      if (!mediaId) return null;

      const metricsRes = await fetch(
        `https://graph.facebook.com/v19.0/${mediaId}/insights?metric=plays,likes,comments&access_token=${process.env.IG_GRAPH_ACCESS_TOKEN}`
      );
      if (!metricsRes.ok) return null;
      const data = await metricsRes.json();
      const byName = Object.fromEntries(
        (data.data ?? []).map((m: { name: string; values: { value: number }[] }) => [m.name, m.values?.[0]?.value])
      );
      return { views: byName.plays, likes: byName.likes, comments: byName.comments };
    } catch {
      return null;
    }
  }

  // TikTok — placeholder until OAuth is configured
  if (platform === "tiktok" && process.env.TIKTOK_CLIENT_KEY) {
    // TikTok Display API requires per-user OAuth — skip for now
    return null;
  }

  return null;
}

async function sendPicDigests(admin: ReturnType<typeof createAdminClient>) {
  // Only send at 9am UTC (cron runs hourly, check current hour)
  if (new Date().getUTCHours() !== 9) return;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: picIds } = await admin
    .from("deliverables")
    .select("assigned_pic")
    .not("assigned_pic", "is", null);

  const uniquePics = [...new Set((picIds ?? []).map(r => r.assigned_pic).filter(Boolean))];

  const transporter = createTransporter();

  for (const picId of uniquePics) {
    try {
      const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", picId).single();
      if (!profile?.email) continue;

      const { data: myDeliverables } = await admin
        .from("deliverables")
        .select("id, deliverable_type, title, status, updated_at, deal:deal_id(influencer_name)")
        .eq("assigned_pic", picId)
        .gte("updated_at", yesterday);

      if (!myDeliverables?.length) continue;

      const lines = myDeliverables.map(d => {
        const dealRaw = d.deal;
        const deal = (Array.isArray(dealRaw) ? dealRaw[0] : dealRaw) as { influencer_name: string } | null;
        return `• ${deal?.influencer_name ?? "Unknown"} — ${d.deliverable_type}: ${d.status.replace("_", " ")}`;
      }).join("\n");

      await transporter.sendMail({
        from: EMAIL_FROM,
        to: profile.email,
        subject: `IM8 Deliverables update — ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`,
        text: `Hi ${profile.full_name},\n\nHere are the deliverables assigned to you that changed in the last 24 hours:\n\n${lines}\n\nLog in at https://creators.im8health.com/admin/deliverables to review.\n\nIM8 Team`,
      });
    } catch (err) {
      console.error(`[poll-metrics] Digest failed for ${picId}:`, err);
    }
  }
}
