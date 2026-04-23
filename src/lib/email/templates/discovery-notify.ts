export function discoveryNotifyTemplate(params: {
  influencerName: string;
  status: string;
  message?: string | null;
  portalUrl?: string | null;
}) {
  const { influencerName, status, message, portalUrl } = params;
  const prettyStatus = status.replace(/_/g, " ");
  const subject = `Update on your IM8 submission: ${influencerName}`;
  const text = [
    `Hi there,`,
    ``,
    `Quick update on the creator profile you submitted to IM8 — ${influencerName}.`,
    ``,
    `Current status: ${prettyStatus}.`,
    message ? `\nNote from the IM8 team:\n${message}\n` : ``,
    portalUrl ? `View details in your dashboard: ${portalUrl}` : ``,
    ``,
    `— IM8 Influencer Team`,
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family:-apple-system,system-ui,sans-serif;color:#3a1e1e;max-width:560px">
      <p>Hi there,</p>
      <p>Quick update on the creator profile you submitted to IM8 — <strong>${influencerName}</strong>.</p>
      <p>Current status: <strong style="text-transform:capitalize">${prettyStatus}</strong>.</p>
      ${message ? `<p><em>Note from the IM8 team:</em></p><blockquote style="border-left:3px solid #c13a3a;padding-left:12px;color:#5a3a3a">${message.replace(/\n/g, "<br>")}</blockquote>` : ""}
      ${portalUrl ? `<p><a href="${portalUrl}" style="background:#c13a3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">View in dashboard</a></p>` : ""}
      <p style="color:#8a6a6a;font-size:12px">— IM8 Influencer Team</p>
    </div>
  `;

  return { subject, text, html };
}
