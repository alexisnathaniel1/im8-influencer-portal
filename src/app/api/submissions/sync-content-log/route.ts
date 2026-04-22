import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncContentLogEntry } from "@/lib/google/sheets";

export async function POST(request: Request) {
  try {
    const { submissionId } = await request.json();
    if (!submissionId) return NextResponse.json({ error: "submissionId required" }, { status: 400 });

    const supabase = createAdminClient();

    const { data: sub } = await supabase
      .from("submissions")
      .select(`
        id, drive_url, file_name, platform, content_type, post_url,
        submitted_at, reviewed_at, reviewed_by,
        influencer:influencer_id(full_name, email),
        deal:deal_id(influencer_name, platform_primary)
      `)
      .eq("id", submissionId)
      .single();

    if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

    let approvedByName: string | null = null;
    if (sub.reviewed_by) {
      const { data: reviewer } = await supabase.from("profiles").select("full_name").eq("id", sub.reviewed_by).single();
      approvedByName = reviewer?.full_name ?? null;
    }

    const influencer = sub.influencer as unknown as { full_name: string; email: string } | null;
    const deal = sub.deal as unknown as { influencer_name: string; platform_primary: string } | null;

    await syncContentLogEntry({
      submissionId: sub.id,
      influencerName: influencer?.full_name || deal?.influencer_name || "",
      email: influencer?.email || "",
      dealId: (sub as Record<string, unknown>).deal_id as string,
      platform: sub.platform || deal?.platform_primary || null,
      contentType: sub.content_type,
      fileName: sub.file_name,
      driveUrl: sub.drive_url,
      postUrl: sub.post_url,
      submittedAt: sub.submitted_at,
      reviewedAt: sub.reviewed_at,
      approvedByName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Content log sync error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 500 });
  }
}
