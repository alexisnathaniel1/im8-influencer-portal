import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeEmail } from "@/lib/ai/email-summary";

export const maxDuration = 300; // 5 min — needed when backfilling many emails

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);

  const admin = createAdminClient();

  // Find emails that haven't been summarized yet, oldest-pending first
  const { data: pending, error } = await admin
    .from("inbox_emails")
    .select("id, from_email, from_name, subject, body_text")
    .is("ai_summary", null)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[inbox/summarize-all] fetch failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, succeeded: 0, message: "All emails already summarized" });
  }

  let succeeded = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      const result = await summarizeEmail({
        from_name: row.from_name as string | null,
        from_email: row.from_email as string,
        subject: row.subject as string,
        body_text: row.body_text as string | null,
      });
      if (result) {
        await admin
          .from("inbox_emails")
          .update({ ai_summary: result.summary, ai_next_steps: result.next_steps })
          .eq("id", row.id);
        succeeded++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`[inbox/summarize-all] failed ${row.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: pending.length,
    succeeded,
    failed,
    remaining: pending.length === limit ? "Run again to process more" : 0,
  });
}
