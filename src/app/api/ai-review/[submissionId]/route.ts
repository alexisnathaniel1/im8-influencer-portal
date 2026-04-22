import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("ai_reviews")
      .select("*")
      .eq("submission_id", submissionId)
      .single();

    if (error || !data) return NextResponse.json({ data: null });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("AI review fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch AI review" }, { status: 500 });
  }
}
