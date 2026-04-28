import { emailShell, ctaButton, infoCard, sectionLabel } from "./base";

// Canonical catalogue — kept in sync with deal-detail-client.tsx and
// triage-board.tsx so the same labels surface in admin UI, partner
// dashboard, deal contracts, and outbound emails.
const DELIVERABLE_LABELS: Record<string, string> = {
  IGR: "Instagram Reels",
  IGS: "Instagram Stories",
  TIKTOK: "TikTok Videos",
  YT_DEDICATED: "YouTube Dedicated Review",
  YT_INTEGRATED: "YouTube Integrated Review",
  YT_PODCAST: "YouTube Podcast Ad Read",
  UGC: "UGC Videos",
  NEWSLETTER: "Newsletter",
  APP_PARTNERSHIP: "App Partnership",
  BLOG: "Blog Post",
  WHITELIST: "Whitelisting",
  PAID_AD: "Paid Ad Usage Rights",
  RAW_FOOTAGE: "Raw Footage",
  LINK_BIO: "Link in Bio",
};

// Codes that are binary Yes/No grants rather than countable content
// deliverables. These render in the "Usage rights" block, not the
// numbered "Deliverables" list.
const BINARY_DELIVERABLE_CODES = new Set(["WHITELIST", "PAID_AD", "RAW_FOOTAGE", "LINK_BIO"]);

export function negotiationCounterTemplate(params: {
  influencerName: string;
  submitterName: string;
  isAgency: boolean;
  rateUsd: number | null;
  totalMonths: number;
  deliverables: Array<{ code: string; count: number }>;
  notes: string | null;
  portalUrl: string | null;
  loginUrl: string | null;
  signupUrl: string | null;
}) {
  const {
    influencerName, submitterName, isAgency, rateUsd, totalMonths,
    deliverables, notes, portalUrl, loginUrl, signupUrl,
  } = params;
  const totalUsd = rateUsd ? rateUsd * totalMonths : null;

  // Split the incoming deliverables into countable content items vs binary
  // rights. Counted content goes in the numbered list; rights render below
  // as a checklist with friendly labels (Whitelisting, etc) — never as
  // raw enum codes (WHITELIST, PAID_AD, …).
  const contentDeliverables = deliverables.filter(d => !BINARY_DELIVERABLE_CODES.has(d.code) && d.count > 0);
  const grantedRights = deliverables.filter(d => BINARY_DELIVERABLE_CODES.has(d.code) && d.count > 0);

  // Agencies submit on behalf of named creators, so the email refers to the
  // creator by name. Individual creators are submitting themselves, so the
  // copy is more personal — "your profile" instead of "{name}'s profile".
  const introTextLine = isAgency
    ? `Thank you for submitting ${influencerName} to IM8. We've reviewed the profile and have a counter-proposal for your consideration.`
    : `Thank you for submitting your profile to IM8. We've reviewed it and have a counter-proposal for your consideration.`;
  const introHtmlLine = isAgency
    ? `Thank you for submitting <strong>${influencerName}</strong> to IM8. We've reviewed the profile and have a counter-proposal for your consideration.`
    : `Thank you for submitting your profile to IM8. We've reviewed it and have a counter-proposal for your consideration.`;

  const rateText = rateUsd
    ? `$${rateUsd.toLocaleString()}/month ($${totalUsd!.toLocaleString()} total over ${totalMonths} month${totalMonths === 1 ? "" : "s"})`
    : "To be confirmed";

  const subject = `IM8 counter-proposal for ${influencerName}`;

  const text = [
    `Hi ${submitterName},`,
    ``,
    introTextLine,
    ``,
    `── COUNTER-PROPOSAL ──`,
    `Creator: ${influencerName}`,
    ``,
    `Deliverables:`,
    ...contentDeliverables.map(d => `  • ${d.count} × ${DELIVERABLE_LABELS[d.code] ?? d.code}`),
    ``,
    `Usage rights & extras:`,
    ...grantedRights.map(d => `  • ${DELIVERABLE_LABELS[d.code] ?? d.code}`),
    ``,
    `Rate: ${rateText}`,
    ``,
    notes ? `Notes from IM8:\n${notes}\n` : null,
    `── NEXT STEPS ──`,
    ``,
    `Log in to your IM8 dashboard to accept or decline this proposal:`,
    loginUrl ?? portalUrl ?? `https://portal.im8health.com/auth/login`,
    ``,
    signupUrl ? `Don't have an account yet? Sign up here (we'll automatically link your submission):\n${signupUrl}\n` : null,
    `Please do not reply to this email — all communication must go through your dashboard.`,
    ``,
    `— IM8 Influencer Team`,
  ].filter(l => l !== null).join("\n");

  // Deliverables rows — content only (counted)
  const deliverablesHtml = contentDeliverables
    .map(d => `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#1A0508;border-bottom:1px solid #E1CBB9">${DELIVERABLE_LABELS[d.code] ?? d.code}</td>
        <td style="padding:6px 0;font-size:14px;font-weight:700;color:#50000B;border-bottom:1px solid #E1CBB9;text-align:right;padding-left:24px">${d.count}×</td>
      </tr>`)
    .join("");

  // Usage rights & extras — rendered with friendly labels from the catalogue
  const usageHtml = grantedRights
    .map(d => `
      <tr>
        <td style="padding:4px 0;vertical-align:top"><span style="color:#A40011;font-weight:700">✓</span></td>
        <td style="padding:4px 0;font-size:13px;color:#3D0010;padding-left:10px">${DELIVERABLE_LABELS[d.code] ?? d.code}</td>
      </tr>`)
    .join("");

  const proposalCard = infoCard(`
    ${sectionLabel(`Counter-proposal for ${influencerName}`)}

    <div style="margin:16px 0">
      ${sectionLabel("Deliverables")}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${deliverablesHtml}
      </table>
    </div>

    ${grantedRights.length > 0 ? `
    <div style="margin:16px 0">
      ${sectionLabel("Usage rights & extras")}
      <table role="presentation" cellpadding="0" cellspacing="0">
        ${usageHtml}
      </table>
    </div>` : ""}

    <div style="margin:16px 0 0">
      ${sectionLabel("Rate")}
      <p style="margin:0;font-size:22px;font-weight:700;color:#50000B;font-family:Georgia,'Times New Roman',serif">
        ${rateUsd ? `$${rateUsd.toLocaleString()}<span style="font-size:14px;font-weight:400;color:#8C7A6E">&nbsp;/month</span>` : "To be confirmed"}
      </p>
      ${totalUsd ? `<p style="margin:4px 0 0;font-size:13px;color:#8C7A6E">$${totalUsd.toLocaleString()} total over ${totalMonths} month${totalMonths === 1 ? "" : "s"}</p>` : ""}
    </div>
  `);

  const notesHtml = notes ? `
    <div style="border-left:3px solid #A40011;padding:12px 16px;margin:20px 0;background:#FFF5F5;border-radius:0 8px 8px 0">
      ${sectionLabel("Notes from the IM8 team")}
      <p style="margin:6px 0 0;font-size:14px;color:#3D0010;white-space:pre-wrap">${notes.replace(/\n/g, "<br>")}</p>
    </div>
  ` : "";

  const loginHref = loginUrl ?? portalUrl ?? "https://portal.im8health.com/auth/login";

  const signupBanner = signupUrl ? `
    <div style="background:#FAF6F2;border:1px solid #E1CBB9;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:13px;color:#5A000B">
      Don't have an account yet?&nbsp;
      <a href="${signupUrl}" style="color:#A40011;font-weight:700;text-decoration:none">Sign up here</a>
      &nbsp;— we'll automatically link your submission, no re-filling required.
    </div>
  ` : "";

  const body = `
    <p style="margin:0 0 20px">Hi <strong>${submitterName}</strong>,</p>

    <p style="margin:0 0 20px">${introHtmlLine}</p>

    ${proposalCard}
    ${notesHtml}

    <p style="margin:20px 0 8px;font-size:15px;font-weight:600;color:#50000B">Next steps</p>
    <p style="margin:0 0 16px;font-size:14px;color:#3D0010">
      Log in to your IM8 dashboard to <strong>accept or decline</strong> this proposal.
    </p>
    ${ctaButton("Log in to respond →", loginHref)}
    ${signupBanner}
  `;

  const html = emailShell(body, { portalUrl: loginHref });

  return { subject, text, html };
}
