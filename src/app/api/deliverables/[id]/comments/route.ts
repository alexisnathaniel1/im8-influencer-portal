import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/permissions";
import { slackNotify } from "@/lib/slack/notify";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Determine viewer's role so we know whether to filter to partner-visible only.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdminRole = profile && ADMIN_ROLES.includes(profile.role);

  let q = admin
    .from("deliverable_comments")
    .select("id, deliverable_id, author_id, author_display_name, body, visible_to_partner, created_at")
    .eq("deliverable_id", id)
    .order("created_at", { ascending: true });

  // Partners only see comments flagged visible_to_partner.
  // RLS enforces this too — this is defence-in-depth.
  if (!isAdminRole) {
    q = q.eq("visible_to_partner", true);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: deliverableId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body: commentBody, visibleToPartner } = (await request.json()) as {
    body?: string;
    visibleToPartner?: boolean;
  };
  if (!commentBody?.trim()) return NextResponse.json({ error: "Empty comment" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const isAdminRole = profile && ADMIN_ROLES.includes(profile.role);

  // Default visibility: partners' comments are always partner-visible (they
  // can see what they wrote). Admins default to internal-only unless they
  // explicitly tick the "Visible to partner" checkbox.
  const computedVisible = isAdminRole ? !!visibleToPartner : true;

  const { data, error } = await admin
    .from("deliverable_comments")
    .insert({
      deliverable_id: deliverableId,
      author_id: user.id,
      author_display_name: profile?.full_name ?? (isAdminRole ? "Admin" : "Partner"),
      body: commentBody.trim(),
      visible_to_partner: computedVisible,
    })
    .select("id, deliverable_id, author_id, author_display_name, body, visible_to_partner, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Slack-notify the team when the partner posts a comment so inbound feedback
  // gets seen quickly. Admin-side comments don't need to ping Slack — admins
  // are already in the loop.
  if (!isAdminRole) {
    try {
      const { data: deliverable } = await admin
        .from("deliverables")
        .select("deliverable_type, sequence, deal:deal_id(influencer_name)")
        .eq("id", deliverableId)
        .single();
      const deal = deliverable?.deal as unknown as { influencer_name: string } | null;
      const creator = deal?.influencer_name ?? "Partner";
      const type = (deliverable?.deliverable_type as string | null) ?? "Content";
      const seq = (deliverable?.sequence as number | null) ?? "";
      const preview = commentBody.length > 120 ? commentBody.slice(0, 120) + "…" : commentBody;
      void slackNotify(
        `💬 *Comment* — ${creator} on ${type}${seq ? ` #${seq}` : ""}: "${preview}"`,
      );
    } catch (notifyErr) {
      console.warn("[deliverable-comments] Slack notify failed:", notifyErr);
    }
  }

  return NextResponse.json({ comment: data });
}
