import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";
import { negotiationCounterTemplate } from "@/lib/email/templates/negotiation-counter";
import { formatDeliverablesSummary } from "@/lib/deliverables";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", management: "Management", support: "Support",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { to, rate_usd, deliverables, notes, total_months = 3 } = body as {
    to: string;
    rate_usd: number | null;
    deliverables: Array<{ code: string; count: number }>;
    notes: string | null;
    total_months?: number;
  };

  if (!to) return NextResponse.json({ error: "Missing recipient email" }, { status: 400 });

  const admin = createAdminClient();

  // Auth check
  const { data: actorProfile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!actorProfile || !["admin", "management", "support"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorName = actorProfile.full_name || user.email || "Admin";
  const actorDisplay = `${actorName} · ${ROLE_LABELS[actorProfile.role] ?? actorProfile.role}`;

  // Load the discovery profile to get creator name, submitter info, agency flag
  const { data: profile } = await admin
    .from("discovery_profiles")
    .select("influencer_name, submitter_name, agency_name, submitter_email")
    .eq("id", id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const isAgency = !!profile.agency_name;
  const submitterName = profile.submitter_name || (isAgency ? profile.agency_name : "there") || "there";

  // Save the updated counter-proposal fields to the discovery profile.
  // Also store the recipient email as influencer_email so the creator can be
  // auto-linked to their portal account when they sign up via this email.
  // Status flips to 'negotiation_needed' on every counter — covers both the
  // initial admin counter from 'new' AND admin's reply to a creator counter
  // (resetting from 'creator_countered' back to admin-side pending).
  // agency_response is reset so the partner-side block shows the new
  // counter, not the previous accept/decline state.
  const rate_cents = rate_usd ? Math.round(rate_usd * 100) : null;

  // Try to update with the full payload first. If the deployed DB hasn't
  // had migration 044 applied yet, creator_counter_note won't exist and
  // the update will fail wholesale — so we fall back to the legacy column
  // set, which is enough to flip the row back into a fresh negotiation
  // state (status + agency_response reset) so the creator sees the
  // counter again on /partner.
  const fullPayload: Record<string, unknown> = {
    proposed_rate_cents: rate_cents ?? undefined,
    proposed_deliverables: deliverables,
    negotiation_counter: notes ?? null,
    total_months: total_months,
    influencer_email: to,
    status: "negotiation_needed",
    agency_response: null,
    creator_counter_note: null,
  };
  let { error: updateError } = await admin.from("discovery_profiles").update(fullPayload).eq("id", id);

  if (updateError && /creator_counter_note/.test(updateError.message)) {
    console.warn("[discovery/counter] migration 044 not yet applied — falling back without creator_counter_note");
    delete fullPayload.creator_counter_note;
    ({ error: updateError } = await admin.from("discovery_profiles").update(fullPayload).eq("id", id));
  }

  if (updateError) {
    console.error("[discovery/counter] update failed:", updateError.message, "id:", id);
    return NextResponse.json({ error: `Could not save counter-proposal: ${updateError.message}` }, { status: 500 });
  }

  // Send the email.
  // Three URLs passed to the template:
  //   portalUrl — deep link to /partner (used once logged in)
  //   loginUrl  — /auth/login pre-filled with email (primary CTA)
  //   signupUrl — /auth/signup pre-filled with email; only sent when the
  //               recipient does NOT yet have a portal account, so we don't
  //               nudge people to sign up when they already can log in.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const emailParam = encodeURIComponent(to);
  const portalUrl = siteUrl ? `${siteUrl}/partner` : null;
  const loginUrl = siteUrl ? `${siteUrl}/auth/login?email=${emailParam}` : null;

  // Look up whether `to` already has a profile (= can log in). The cheapest
  // safe check is profiles.email; falls through to no-account behaviour on error.
  let hasAccount = false;
  try {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .ilike("email", to);
    hasAccount = (count ?? 0) > 0;
  } catch (err) {
    console.error("[discovery/counter] profile lookup failed:", err);
  }
  const signupUrl = !hasAccount && siteUrl ? `${siteUrl}/auth/signup?email=${emailParam}` : null;

  const { subject, text, html } = negotiationCounterTemplate({
    influencerName: profile.influencer_name,
    submitterName,
    isAgency,
    rateUsd: rate_usd,
    totalMonths: total_months,
    deliverables,
    notes: notes || null,
    portalUrl,
    loginUrl,
    signupUrl,
  });

  try {
    await createTransporter().sendMail({ from: EMAIL_FROM, to, subject, text, html });
  } catch (err) {
    console.error("[discovery/counter] Email send failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  // Log to activity feed
  const deliverablesSummary = formatDeliverablesSummary(deliverables);
  const rateNote = rate_usd ? `$${rate_usd.toLocaleString()}/mo` : "rate TBC";

  const { data: comment } = await admin.from("discovery_comments").insert({
    discovery_profile_id: id,
    author_id: user.id,
    author_display_name: actorDisplay,
    body: `Counter-proposal sent to ${to}.\nRate: ${rateNote} · Duration: ${total_months}mo · Deliverables: ${deliverablesSummary}${notes ? `\nNotes: ${notes}` : ""}`,
    visible_to_partner: true,
    kind: "notify",
  }).select("*").single();

  return NextResponse.json({ success: true, comment });
}
