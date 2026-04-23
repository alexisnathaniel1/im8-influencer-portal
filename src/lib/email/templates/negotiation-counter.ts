const DELIVERABLE_LABELS: Record<string, string> = {
  IGR: "Instagram Reels",
  IGS: "Instagram Stories",
  UGC: "UGC Videos (for ads)",
  TIKTOK: "TikTok Videos",
  YT: "YouTube Videos",
};

const STANDARD_USAGE_RIGHTS = ["Whitelisting", "Paid ad usage rights", "Link in bio"];

export function negotiationCounterTemplate(params: {
  influencerName: string;
  submitterName: string;
  isAgency: boolean;
  rateUsd: number | null;
  totalMonths: number;
  deliverables: Array<{ code: string; count: number }>;
  notes: string | null;
  portalUrl: string | null;
}) {
  const { influencerName, submitterName, isAgency, rateUsd, totalMonths, deliverables, notes, portalUrl } = params;
  const totalUsd = rateUsd ? rateUsd * totalMonths : null;
  const recipientLabel = isAgency ? "agency" : "creator";

  const deliverablesText = deliverables
    .map(d => `  • ${d.count} × ${DELIVERABLE_LABELS[d.code] ?? d.code}`)
    .join("\n");

  const usageText = STANDARD_USAGE_RIGHTS.map(r => `  • ${r}`).join("\n");

  const rateText = rateUsd
    ? `$${rateUsd.toLocaleString()}/month ($${totalUsd!.toLocaleString()} total over ${totalMonths} months)`
    : "To be confirmed";

  const subject = `IM8 counter-proposal for ${influencerName}`;

  const text = [
    `Hi ${submitterName},`,
    ``,
    `Thank you for submitting ${influencerName} to IM8. We've reviewed the profile and have a counter-proposal for your consideration.`,
    ``,
    `── COUNTER-PROPOSAL ──`,
    ``,
    `Creator: ${influencerName}`,
    ``,
    `Deliverables:`,
    deliverablesText,
    ``,
    `Usage rights (included as standard):`,
    usageText,
    ``,
    `Rate: ${rateText}`,
    ``,
    notes ? `Additional notes from IM8:\n${notes}` : null,
    notes ? `` : null,
    `── NEXT STEPS ──`,
    ``,
    `Please log in to your IM8 dashboard to accept or decline this proposal:`,
    portalUrl ? portalUrl : `https://portal.im8health.com/partner`,
    ``,
    `Do not reply to this email — responses sent here will not be seen. All communication and responses must go through your dashboard.`,
    ``,
    `— IM8 Influencer Team`,
  ].filter(l => l !== null).join("\n");

  const deliverablesHtml = deliverables
    .map(d => `<tr><td style="padding:4px 0;color:#3a1e1e">${DELIVERABLE_LABELS[d.code] ?? d.code}</td><td style="padding:4px 0 4px 16px;font-weight:600;color:#3a1e1e">${d.count}</td></tr>`)
    .join("");

  const usageHtml = STANDARD_USAGE_RIGHTS
    .map(r => `<li style="margin:2px 0;color:#5a3a3a">${r}</li>`)
    .join("");

  const html = `
    <div style="font-family:-apple-system,system-ui,sans-serif;color:#3a1e1e;max-width:600px;margin:0 auto">
      <div style="background:#6b1a1a;padding:24px 32px;border-radius:12px 12px 0 0">
        <p style="color:#fff;margin:0;font-size:18px;font-weight:700">IM8 — Counter-proposal</p>
      </div>
      <div style="background:#fff;border:1px solid #e8e0d8;border-top:none;border-radius:0 0 12px 12px;padding:32px">
        <p>Hi <strong>${submitterName}</strong>,</p>
        <p>Thank you for submitting <strong>${influencerName}</strong> to IM8. We've reviewed the profile and have a counter-proposal for your consideration.</p>

        <div style="background:#faf7f4;border:1px solid #e8e0d8;border-radius:8px;padding:20px;margin:24px 0">
          <p style="margin:0 0 16px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8a6a6a">Counter-proposal for ${influencerName}</p>

          <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#8a6a6a">Deliverables</p>
          <table style="border-collapse:collapse;margin-bottom:16px;width:100%">
            ${deliverablesHtml}
          </table>

          <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#8a6a6a">Usage rights (standard inclusions)</p>
          <ul style="margin:0 0 16px;padding-left:18px">${usageHtml}</ul>

          <p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#8a6a6a">Rate</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#6b1a1a">${rateUsd ? `$${rateUsd.toLocaleString()}<span style="font-size:13px;font-weight:400;color:#8a6a6a">/month</span>` : "To be confirmed"}</p>
          ${totalUsd ? `<p style="margin:4px 0 0;font-size:12px;color:#8a6a6a">$${totalUsd.toLocaleString()} total over ${totalMonths} months</p>` : ""}
        </div>

        ${notes ? `
        <div style="border-left:3px solid #c13a3a;padding-left:12px;margin:0 0 24px">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#8a6a6a">Additional notes from IM8</p>
          <p style="margin:0;color:#3a1e1e;white-space:pre-wrap">${notes.replace(/\n/g, "<br>")}</p>
        </div>
        ` : ""}

        <div style="background:#f0f7f0;border:1px solid #c3e0c3;border-radius:8px;padding:16px;margin:0 0 24px">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2d6a2d">Next steps</p>
          <p style="margin:0 0 12px;font-size:14px;color:#3a1e1e">Please log in to your IM8 dashboard to <strong>accept or decline</strong> this proposal.</p>
          ${portalUrl ? `<a href="${portalUrl}" style="display:inline-block;background:#6b1a1a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Respond on your dashboard →</a>` : ""}
        </div>

        <p style="font-size:12px;color:#a08080;border-top:1px solid #e8e0d8;padding-top:16px;margin:0">
          Please do not reply to this email — responses sent here will not be seen by our team.<br>
          All communication and responses must go through your <a href="${portalUrl ?? "#"}" style="color:#c13a3a">IM8 dashboard</a>.
        </p>
      </div>
    </div>
  `;

  return { subject, text, html };
}
