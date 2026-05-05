import { emailShell, ctaButton, infoCard, sectionLabel } from "./base";

interface ContentSubmittedParams {
  creatorName: string;
  deliverableType: string;
  sequence: number | null;
  dealId: string;
  submittedAt: string;
  portalUrl?: string | null;
}

export function contentSubmittedTemplate({
  creatorName,
  deliverableType,
  sequence,
  dealId,
  submittedAt,
  portalUrl,
}: ContentSubmittedParams): { subject: string; text: string; html: string } {
  const label = `${deliverableType}${sequence ? ` #${sequence}` : ""}`;
  const reviewUrl = `${portalUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/deals/${dealId}?tab=submissions`;
  const submittedDate = new Date(submittedAt).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const subject = `[Action needed] ${creatorName} submitted ${label} for review`;

  const text = [
    `Action needed: ${creatorName} has submitted their draft for ${label}.`,
    "",
    `Submitted: ${submittedDate}`,
    "",
    `Review it here: ${reviewUrl}`,
    "",
    "— IM8 Influencer Portal",
  ].join("\n");

  const html = emailShell(
    `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#50000B;font-family:Georgia,'Times New Roman',serif">
      Content submitted for review
    </h2>
    <p style="margin:0 0 24px;color:#8C7A6E;font-size:14px">Action required — a creator has uploaded their draft.</p>

    ${infoCard(`
      ${sectionLabel("Creator")}
      <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#50000B">${creatorName}</p>
      ${sectionLabel("Deliverable")}
      <p style="margin:0 0 12px;font-size:15px;color:#1A0508">${label}</p>
      ${sectionLabel("Submitted")}
      <p style="margin:0;font-size:14px;color:#8C7A6E">${submittedDate}</p>
    `)}

    <p style="margin:0 0 4px;font-size:14px;color:#1A0508">
      Please review and respond within <strong>3 days</strong> per the content calendar schedule.
    </p>

    ${ctaButton("Review submission →", reviewUrl)}
    `,
    { portalUrl },
  );

  return { subject, text, html };
}
