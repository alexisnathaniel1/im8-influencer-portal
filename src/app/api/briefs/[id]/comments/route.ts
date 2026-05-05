import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — list comments for a brief (auth via RLS — admin sees all, creator sees own)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: briefId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("brief_comments")
    .select("id, body, author_name, author_role, created_at, read_by_admin")
    .eq("brief_id", briefId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ comments: data ?? [] });
}

// POST — add a comment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: briefId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { body?: string };
  const text = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Body required" }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "Comment too long (max 4000 chars)" }, { status: 400 });

  const admin = createAdminClient();

  // Look up author profile + verify they have access to this brief
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: brief } = await admin
    .from("briefs")
    .select("id, deal_id")
    .eq("id", briefId)
    .single();
  if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

  const role = (profile.role as string) ?? "creator";
  const isStaff = ["admin", "management", "support"].includes(role);

  // Creators must own the deal — verify via influencer_profile_id
  if (!isStaff) {
    const { data: deal } = await admin
      .from("deals")
      .select("influencer_profile_id")
      .eq("id", brief.deal_id)
      .single();
    if (!deal || deal.influencer_profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: inserted, error: insertErr } = await admin
    .from("brief_comments")
    .insert({
      brief_id: briefId,
      deal_id: brief.deal_id,
      author_id: user.id,
      author_name: (profile.full_name as string) ?? "Unknown",
      author_role: isStaff ? role : "creator",
      body: text,
      read_by_admin: isStaff, // staff posts auto-read
    })
    .select("id, body, author_name, author_role, created_at, read_by_admin")
    .single();

  if (insertErr) {
    console.error("[briefs/comments] insert failed:", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ comment: inserted });
}

// PATCH — mark all unread comments on this brief as read (admin only)
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: briefId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "management", "support"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("brief_comments")
    .update({ read_by_admin: true })
    .eq("brief_id", briefId)
    .eq("read_by_admin", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
