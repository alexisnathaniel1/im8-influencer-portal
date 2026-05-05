import { emailShell, ctaButton, infoCard, sectionLabel } from "./base";

interface RevisionRequestedParams {
  creatorName: string;
  deliverableType: string;
  sequence: number | null;
  feedback: string | null;
  portalUrl?: string | null;
}

export function revisionRequestedTemplate({
  creatorName,
  deliverableType,
  sequence,
  feedback,
  portalUrl,
}: RevisionRequestedParams): { subject: string; text: string; html: string } {
  const label = `${deliverableType}${sequence ? ` #${sequence}` : ""}`;
  const partnerUrl = `${portalUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""}/partner`;

  const subject = `Revision needed for your ${label}`;

  const feedbackSection = feedback?.trim()
    ? `\n\nFeedback from the team:\n"${feedback.trim()}"`
    : "";

  const text = [
    `Hi ${creatorName},`,
    "",
    `The IM8 team has reviewed your submission for ${label} and would like you to make some revisions before it goes live.`,
    feedbackSection,
    "",
    "Please log into your partner portal to view the details and re-upload your revised content:",
    partnerUrl,
    "",
    "— The IM8 Creator Team",
  ].join("\n");

  const html = emailShell(
    `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#50000B;font-family:Georgia,'Times New Roman',serif">
      Revision requested for ${label}
    </h2>
    <p style="margin:0 0 24px;color:#8C7A6E;font-size:14px">Hi ${creatorName}, the IM8 team has reviewed your submission.</p>

    ${infoCard(`
      ${sectionLabel("Deliverable")}
      <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#50000B">${label}</p>
      ${feedback?.trim() ? `
        ${sectionLabel("Feedback from the team")}
        <p style="margin:0;font-size:14px;color:#1A0508;white-space:pre-wrap;line-height:1.6">${feedback.trim()}</p>
      ` : ""}
    `)}

    <p style="margin:0 0 20px;font-size:14px;color:#1A0508">
      Please review the feedback above and re-upload your revised content through your partner portal. Don't hesitate to reach out if you have any questions.
    </p>

    ${ctaButton("Upload revised content →", partnerUrl)}
    `,
    { portalUrl },
  );

  return { subject, text, html };
}
