import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Deliverable = { code: string; count: number };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const response = body.response as string;
  if (!["accepted", "declined", "countered"].includes(response)) {
    return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Build the update payload based on response type.
  const update: Record<string, unknown> = {
    agency_response: response,
    agency_responded_at: new Date().toISOString(),
    creator_response_at: new Date().toISOString(),
  };

  if (response === "countered") {
    const rateUsd = typeof body.rate_usd === "number" ? body.rate_usd : null;
    const totalMonths = typeof body.total_months === "number" ? body.total_months : 3;
    const deliverables = Array.isArray(body.deliverables) ? body.deliverables as Deliverable[] : [];
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

    update.proposed_rate_cents = rateUsd !== null ? Math.round(rateUsd * 100) : null;
    update.total_months = totalMonths;
    update.proposed_deliverables = deliverables;
    update.creator_counter_note = note;
    update.status = "creator_countered";
    // Reset agency_response so the admin's response card no longer says
    // "you accepted/declined" — it's the admin's move now.
    update.agency_response = null;
  }

  const { error } = await admin
    .from("discovery_profiles")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Log a partner-visible comment recording the response.
  const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
  const { data: discovery } = await admin.from("discovery_profiles").select("agency_name").eq("id", id).single();
  const submitterLabel = discovery?.agency_name ? "Agency" : "Creator";

  let commentBody: string;
  let kind: string;
  if (response === "accepted") {
    commentBody = `${submitterLabel} accepted the counter-proposal.`;
    kind = "agency_response";
  } else if (response === "declined") {
    commentBody = `${submitterLabel} declined the counter-proposal.`;
    kind = "agency_response";
  } else {
    // countered — summarise the new terms in the activity feed
    const rateUsd = typeof body.rate_usd === "number" ? body.rate_usd : null;
    const totalMonths = typeof body.total_months === "number" ? body.total_months : 3;
    const deliverables = Array.isArray(body.deliverables) ? body.deliverables as Deliverable[] : [];
    const summary = deliverables.length
      ? deliverables.map(d => `${d.count}× ${d.code}`).join(", ")
      : "no deliverables specified";
    const rateNote = rateUsd ? `$${rateUsd.toLocaleString()}/mo · ${totalMonths}mo` : "rate TBC";
    const note = typeof body.note === "string" && body.note.trim() ? `\nNote: ${body.note.trim()}` : "";
    commentBody = `${submitterLabel} sent a counter-proposal back to IM8.\nTerms: ${rateNote} · ${summary}${note}`;
    kind = "counter_creator";
  }

  // The creator/agency already sees their own action confirmed in the
  // dedicated UI on /partner ("Counter sent to IM8", "You declined this
  // proposal", etc.). The activity-feed comment is for admins reviewing
  // the row, so visible_to_partner stays false — otherwise the partner
  // page surfaces their own action back to them as a "Latest note from IM8".
  await admin.from("discovery_comments").insert({
    discovery_profile_id: id,
    author_id: user.id,
    author_display_name: profile?.full_name ?? profile?.email ?? submitterLabel,
    body: commentBody,
    visible_to_partner: false,
    kind,
  });

  return NextResponse.json({ ok: true });
}
