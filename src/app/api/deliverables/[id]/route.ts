import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("deliverables").select("*, deliverable_comments(*)").eq("id", id).single();
  return NextResponse.json({ deliverable: data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = [
    "status", "title", "due_date", "live_date", "post_url",
    "views", "likes", "comments_count", "is_story",
    "usage_rights_months", "fee_cents", "assigned_pic", "brief_id",
  ];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  // Set views_updated_at when metrics change
  if ("views" in updates || "likes" in updates || "comments_count" in updates) {
    (updates as Record<string, unknown>).views_updated_at = new Date().toISOString();
  }

  const admin = createAdminClient();
  const { error } = await admin.from("deliverables").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
