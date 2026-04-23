import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appendIntakeHistory } from "@/lib/google/sheets";

// GET /api/admin/test-intake-sheet
// Admin-only: creates the Intake History tab (if missing) and writes a test row.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await appendIntakeHistory({
      submitterName: "Test Submitter",
      submitterEmail: "test@im8health.com",
      submitterAgency: null,
      influencerName: "TEST ROW — DELETE ME",
      platform: "instagram",
      igHandle: "@test",
      tiktokHandle: null,
      youtubeHandle: null,
      followerCount: 10000,
      proposedRateUsd: 500,
      niches: ["Wellness", "Lifestyle"],
      othersNiche: null,
      positioning: "Test positioning for sheet verification",
      proposedDeliverables: [{ code: "IGR", count: 2 }],
      discoveryProfileId: "00000000-0000-0000-0000-000000000000",
    });
    return NextResponse.json({ ok: true, message: "Tab created and test row appended successfully." });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
