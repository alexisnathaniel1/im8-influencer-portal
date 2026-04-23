import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransporter, EMAIL_FROM } from "@/lib/email/client";
import { negotiationCounterTemplate } from "@/lib/email/templates/negotiation-counter";

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

  // Save the updated counter-proposal fields to the discovery profile
  const rate_cents = rate_usd ? Math.round(rate_usd * 100) : null;
  await admin.from("discovery_profiles").update({
    proposed_rate_cents: rate_cents ?? undefined,
    proposed_deliverables: deliverables,
    negotiation_counter: notes ?? null,
    total_months: total_months,
  }).eq("id", id);

  // Send the email
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const portalUrl = siteUrl ? `${siteUrl}/partner` : null;

  const { subject, text, html } = negotiationCounterTemplate({
    influencerName: profile.influencer_name,
    submitterName,
    isAgency,
    rateUsd: rate_usd,
    totalMonths: total_months,
    deliverables,
    notes: notes || null,
    portalUrl,
  });

  try {
    await createTransporter().sendMail({ from: EMAIL_FROM, to, subject, text, html });
  } catch (err) {
    console.error("[discovery/counter] Email send failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  // Log to activity feed
  const deliverablesSummary = deliverables
    .map(d => `${d.count} × ${d.code}`)
    .join(", ");
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
