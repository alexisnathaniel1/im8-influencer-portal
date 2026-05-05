import { emailShell, ctaButton, infoCard, sectionLabel } from "./base";

interface ContentApprovedParams {
  creatorName: string;
  deliverableType: string;
  sequence: number | null;
  portalUrl?: string | null;
}

export function contentApprovedTemplate({
  creatorName,
  deliverableType,
  sequence,
  portalUrl,
}: ContentApprovedParams): { subject: string; text: string; html: string } {
  const label = `${deliverableType}${sequence ? ` #${sequence}` : ""}`;
  const partnerUrl = `${portalUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""}/partner`;

  const subject = `Your ${label} has been approved ✓`;

  const text = [
    `Hi ${creatorName},`,
    "",
    `Great news — your content for ${label} has been reviewed and approved by the IM8 team.`,
    "",
    "You can view the status in your partner portal:",
    partnerUrl,
    "",
    "— The IM8 Creator Team",
  ].join("\n");

  const html = emailShell(
    `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#50000B;font-family:Georgia,'Times New Roman',serif">
      Your content has been approved ✓
    </h2>
    <p style="margin:0 0 24px;color:#8C7A6E;font-size:14px">Hi ${creatorName}, great news from the IM8 team.</p>

    ${infoCard(`
      ${sectionLabel("Deliverable")}
      <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#50000B">${label}</p>
      <p style="margin:0;font-size:14px;color:#5a7a5a">✓ Approved and ready to go</p>
    `)}

    <p style="margin:0 0 20px;font-size:14px;color:#1A0508">
      Your submission has been reviewed and approved. The IM8 team will be in touch with the next steps.
    </p>

    ${ctaButton("View in partner portal →", partnerUrl)}
    `,
    { portalUrl },
  );

  return { subject, text, html };
}
