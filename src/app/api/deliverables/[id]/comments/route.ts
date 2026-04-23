import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("deliverable_comments")
    .select("*")
    .eq("deliverable_id", id)
    .order("created_at", { ascending: true });
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body: commentBody } = await request.json();
  if (!commentBody?.trim()) return NextResponse.json({ error: "Empty comment" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).single();

  const { data, error } = await admin.from("deliverable_comments").insert({
    deliverable_id: id,
    author_id: user.id,
    author_display_name: profile?.full_name ?? "Admin",
    body: commentBody.trim(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
}
