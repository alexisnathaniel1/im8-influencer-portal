import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeEmail } from "@/lib/ai/email-summary";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: email, error } = await admin
    .from("inbox_emails")
    .select("id, from_email, from_name, subject, body_text, ai_summary, ai_next_steps")
    .eq("id", id)
    .single();

  if (error || !email) {
    console.error("[inbox/summarize] not found:", error?.message, "id:", id);
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Return cached
  if (email.ai_summary) {
    return NextResponse.json({
      summary: email.ai_summary,
      next_steps: email.ai_next_steps ?? [],
      cached: true,
    });
  }

  const result = await summarizeEmail({
    from_name: email.from_name as string | null,
    from_email: email.from_email as string,
    subject: email.subject as string,
    body_text: email.body_text as string | null,
  });

  if (!result) {
    return NextResponse.json({ error: "AI summarization failed (check GEMINI_API_KEY)" }, { status: 500 });
  }

  await admin
    .from("inbox_emails")
    .update({ ai_summary: result.summary, ai_next_steps: result.next_steps })
    .eq("id", id);

  return NextResponse.json({ ...result, cached: false });
}
