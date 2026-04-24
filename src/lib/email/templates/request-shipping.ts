export function requestShippingTemplate(params: {
  creatorName: string;
  portalUrl: string;
}) {
  const { creatorName, portalUrl } = params;
  const subject = `Action needed: add your shipping address for IM8`;

  const text = [
    `Hi ${creatorName},`,
    ``,
    `We need your shipping address so IM8 can send you products for your upcoming collaboration.`,
    ``,
    `Please add it here — it only takes a minute:`,
    portalUrl,
    ``,
    `If you've already saved an address in your portal, you can ignore this email.`,
    ``,
    `— IM8 Influencer Team`,
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,system-ui,sans-serif;color:#3a1e1e;max-width:560px">
      <p>Hi ${creatorName},</p>
      <p>We need your shipping address so IM8 can send you products for your upcoming collaboration.</p>
      <p>Please add it here — it only takes a minute:</p>
      <p>
        <a href="${portalUrl}" style="background:#c13a3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">
          Add shipping address
        </a>
      </p>
      <p style="color:#8a6a6a;font-size:13px">If you've already saved an address in your portal, you can ignore this email.</p>
      <p style="color:#8a6a6a;font-size:12px">— IM8 Influencer Team</p>
    </div>
  `;

  return { subject, text, html };
}
