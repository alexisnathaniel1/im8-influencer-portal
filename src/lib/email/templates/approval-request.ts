import { emailShell, ctaButton, sectionLabel } from "./base";
import { formatDeliverablesSummary } from "@/lib/deliverables";

type DealForApproval = {
  influencer_name: string;
  agency_name?: string | null;
  platform_primary?: string | null;
  monthly_rate_cents?: number | null;
  total_months?: number | null;
  rationale?: string | null;
  deliverables?: Array<{ code: string; count: number }> | null;
  contract_sequence?: number | null;
};

export function approvalRequestTemplate(params: {
  approverName: string;
  senderName: string;
  batchTitle: string;
  batchNote: string | null;
  reviewUrl: string;
  deals: DealForApproval[];
}) {
  const { approverName, senderName, batchTitle, batchNote, reviewUrl, deals } = params;

  const totalCount = deals.length;
  const subject = `[IM8] ${totalCount} partnership${totalCount === 1 ? "" : "s"} awaiting your approval — ${batchTitle}`;

  // Plain-text fallback
  const text = [
    `Hi ${approverName},`,
    ``,
    `${senderName} has sent a new batch of influencer partnerships for your approval.`,
    ``,
    `Batch: ${batchTitle}`,
    `Creators: ${totalCount}`,
    ``,
    ...deals.flatMap((d) => {
      const monthlyUsd = d.monthly_rate_cents ? d.monthly_rate_cents / 100 : null;
      const totalUsd = monthlyUsd !== null && d.total_months ? monthlyUsd * d.total_months : null;
      const rateLine = monthlyUsd !== null
        ? `$${monthlyUsd.toLocaleString()}/mo${d.total_months ? ` × ${d.total_months}mo = $${totalUsd!.toLocaleString()}` : ""}`
        : "Rate TBC";
      return [
        `── ${d.influencer_name}${d.contract_sequence ? ` (Contract ${d.contract_sequence})` : ""} ──`,
        d.agency_name ? `Agency: ${d.agency_name}` : null,
        `Platform: ${d.platform_primary ?? "—"}`,
        `Rate: ${rateLine}`,
        `Deliverables: ${formatDeliverablesSummary(d.deliverables ?? null)}`,
        d.rationale ? `Rationale: ${d.rationale}` : null,
        ``,
      ].filter((l): l is string => l !== null);
    }),
    batchNote ? `Note from ${senderName}:\n${batchNote}\n` : null,
    `Review and approve here:`,
    reviewUrl,
    ``,
    `— ${senderName}`,
  ].filter((l) => l !== null).join("\n");

  // HTML — one card per deal, all wrapped in the standard IM8 email shell
  const dealCards = deals.map((d) => {
    const monthlyUsd = d.monthly_rate_cents ? d.monthly_rate_cents / 100 : null;
    const totalUsd = monthlyUsd !== null && d.total_months ? monthlyUsd * d.total_months : null;
    const deliverables = formatDeliverablesSummary(d.deliverables ?? null);
    const platformLabel = d.platform_primary ? d.platform_primary.charAt(0).toUpperCase() + d.platform_primary.slice(1) : "—";

    return `
      <div style="background:#FAF6F2;border:1px solid #E1CBB9;border-radius:12px;padding:20px 24px;margin:0 0 16px">
        <!-- Header -->
        <div style="margin-bottom:14px">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;color:#50000B">
            ${d.influencer_name}
            ${d.contract_sequence ? `<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#A40011;background:#FFFFFF;border:1px solid #E1CBB9;padding:2px 8px;border-radius:6px;margin-left:8px;vertical-align:middle">Contract ${d.contract_sequence}</span>` : ""}
          </p>
          <p style="margin:4px 0 0;font-size:13px;color:#8C7A6E">
            ${platformLabel}${d.agency_name ? ` &nbsp;·&nbsp; ${d.agency_name}` : ""}
          </p>
        </div>

        <!-- Rate + Duration -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px">
          <tr>
            <td width="50%" valign="top" style="padding-right:8px">
              ${sectionLabel("Rate")}
              <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#50000B;font-family:Georgia,'Times New Roman',serif">
                ${monthlyUsd !== null ? `$${monthlyUsd.toLocaleString()}<span style="font-size:12px;font-weight:400;color:#8C7A6E">&nbsp;/mo</span>` : "TBC"}
              </p>
              ${totalUsd !== null ? `<p style="margin:2px 0 0;font-size:11px;color:#8C7A6E">$${totalUsd.toLocaleString()} total</p>` : ""}
            </td>
            <td width="50%" valign="top" style="padding-left:8px">
              ${sectionLabel("Duration")}
              <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#50000B;font-family:Georgia,'Times New Roman',serif">
                ${d.total_months ?? 3}<span style="font-size:12px;font-weight:400;color:#8C7A6E">&nbsp;month${(d.total_months ?? 3) === 1 ? "" : "s"}</span>
              </p>
            </td>
          </tr>
        </table>

        <!-- Deliverables -->
        <div style="margin-bottom:${d.rationale ? "14px" : "0"}">
          ${sectionLabel("Deliverables")}
          <p style="margin:4px 0 0;font-size:13px;color:#3D0010;line-height:1.5">${deliverables}</p>
        </div>

        <!-- Rationale -->
        ${d.rationale ? `
        <div style="border-left:3px solid #A40011;padding-left:12px">
          ${sectionLabel("Rationale")}
          <p style="margin:4px 0 0;font-size:13px;color:#3D0010;line-height:1.5;white-space:pre-wrap">${d.rationale.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>
        </div>` : ""}
      </div>`;
  }).join("");

  const noteBlock = batchNote ? `
    <div style="background:#FFF5F5;border-left:3px solid #A40011;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px">
      ${sectionLabel(`Note from ${senderName}`)}
      <p style="margin:6px 0 0;font-size:14px;color:#3D0010;white-space:pre-wrap">${batchNote.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>
    </div>` : "";

  const body = `
    <p style="margin:0 0 8px">Hi <strong>${approverName}</strong>,</p>
    <p style="margin:0 0 24px;color:#3D0010">
      ${senderName} has sent a new batch of influencer partnerships for your approval.
      Review the details below — you can approve or comment on each creator individually,
      or approve the whole batch at once.
    </p>

    <div style="background:#ffffff;border:2px solid #50000B;border-radius:14px;padding:20px 24px;margin:0 0 24px">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#8C7A6E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">Approval batch</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#50000B;font-family:Georgia,'Times New Roman',serif">${batchTitle}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#8C7A6E">${totalCount} creator${totalCount === 1 ? "" : "s"} awaiting review</p>
    </div>

    ${noteBlock}
    ${dealCards}

    ${ctaButton("Review and approve →", reviewUrl)}

    <p style="margin:24px 0 0;font-size:12px;color:#8C7A6E;text-align:center">
      No login required — you can leave decisions and comments directly via the link above.
    </p>
  `;

  const html = emailShell(body, { portalUrl: reviewUrl });
  return { subject, text, html };
}
