import { emailShell, ctaButton } from "./base";

const STATUS_COPY: Record<string, { headline: string; body: string; accent: string }> = {
  reviewing: {
    headline: "Your submission is under review",
    body: "Our team is reviewing the profile — we'll be in touch shortly with next steps.",
    accent: "#8C7A6E",
  },
  shortlisted: {
    headline: "Great news — you've been shortlisted!",
    body: "The profile has caught our attention. We're moving forward to the next stage of our process.",
    accent: "#2D6A2D",
  },
  negotiation_needed: {
    headline: "We'd like to discuss terms",
    body: "We're interested and would like to explore a collaboration. Please check the details below.",
    accent: "#A05C00",
  },
  approved: {
    headline: "You're approved!",
    body: "We're delighted to confirm the collaboration. Please log in to your dashboard to review next steps.",
    accent: "#2D6A2D",
  },
  declined: {
    headline: "An update on your submission",
    body: "After careful consideration, we won't be moving forward with this profile at this time. Thank you for thinking of us.",
    accent: "#8C7A6E",
  },
};

export function discoveryNotifyTemplate(params: {
  influencerName: string;
  status: string;
  message?: string | null;
  portalUrl?: string | null;
}) {
  const { influencerName, status, message, portalUrl } = params;
  const copy = STATUS_COPY[status] ?? {
    headline: `Update on your submission`,
    body: `There's a new update on the profile you submitted to IM8.`,
    accent: "#8C7A6E",
  };
  const prettyStatus = status.replace(/_/g, " ");
  const subject = `Update on your IM8 submission: ${influencerName}`;

  const text = [
    `Hi there,`,
    ``,
    `Quick update on the creator profile you submitted to IM8 — ${influencerName}.`,
    ``,
    `Current status: ${prettyStatus}.`,
    ``,
    message ? `Note from the IM8 team:\n${message}\n` : null,
    portalUrl ? `View details in your dashboard: ${portalUrl}` : null,
    ``,
    `— IM8 Influencer Team`,
  ].filter(l => l !== null).join("\n");

  const notesHtml = message ? `
    <div style="border-left:3px solid #A40011;padding:12px 16px;margin:20px 0;background:#FFF5F5;border-radius:0 8px 8px 0">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#8C7A6E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">Note from the IM8 team</p>
      <p style="margin:0;font-size:14px;color:#3D0010;white-space:pre-wrap">${message.replace(/\n/g, "<br>")}</p>
    </div>
  ` : "";

  const body = `
    <p style="margin:0 0 20px">Hi there,</p>

    <!-- Status indicator -->
    <div style="border-left:4px solid ${copy.accent};padding:12px 16px;margin:0 0 24px;background:#FAF6F2;border-radius:0 8px 8px 0">
      <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#50000B">${copy.headline}</p>
      <p style="margin:0;font-size:13px;color:#8C7A6E;text-transform:capitalize">Creator: <strong style="color:#1A0508">${influencerName}</strong></p>
    </div>

    <p style="margin:0 0 20px;font-size:15px;color:#3D0010">${copy.body}</p>

    ${notesHtml}

    ${portalUrl ? ctaButton("View in your dashboard →", portalUrl) : ""}

    <p style="margin:24px 0 0;font-size:14px;color:#5A000B;font-weight:600">— IM8 Influencer Team</p>
  `;

  const html = emailShell(body, { portalUrl });

  return { subject, text, html };
}
