import { emailShell, ctaButton } from "./base";

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
    `It only takes a minute to add — log in to your portal here:`,
    portalUrl,
    ``,
    `If you've already saved an address in your portal, you can ignore this email.`,
    ``,
    `— IM8 Influencer Team`,
  ].join("\n");

  const body = `
    <p style="margin:0 0 20px">Hi <strong>${creatorName}</strong>,</p>

    <p style="margin:0 0 20px">
      We need your shipping address so IM8 can send you products for your
      upcoming collaboration. It only takes a minute to add.
    </p>

    <!-- What to expect -->
    <div style="background:#FAF6F2;border:1px solid #E1CBB9;border-radius:12px;padding:20px 24px;margin:0 0 24px">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#8C7A6E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">Why we need this</p>
      <p style="margin:6px 0 0;font-size:14px;color:#3D0010">
        IM8 ships product samples and gifting to our partner creators ahead of campaign launch.
        Your address is stored securely in your portal and only used for this purpose.
      </p>
    </div>

    ${ctaButton("Add my shipping address →", portalUrl)}

    <p style="margin:0;font-size:13px;color:#8C7A6E">
      Already added your address? You can ignore this email — we'll pull it automatically.
    </p>

    <p style="margin:24px 0 0;font-size:14px;color:#5A000B;font-weight:600">— IM8 Influencer Team</p>
  `;

  const html = emailShell(body, { portalUrl });

  return { subject, text, html };
}
