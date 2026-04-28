import { emailShell, ctaButton } from "./base";

export function partnerInviteTemplate(params: {
  influencerName: string;
  inviteUrl: string;
  adminName?: string | null;
}) {
  const { influencerName, inviteUrl, adminName } = params;
  const from = adminName ? `${adminName} from IM8` : "The IM8 Team";
  const subject = `You're invited to the IM8 Partner Portal`;

  const text = [
    `Hi ${influencerName},`,
    ``,
    `${from} has approved your collaboration and invited you to the IM8 Partner Portal.`,
    ``,
    `Your portal gives you access to:`,
    `  • Your collaboration details and deliverables`,
    `  • Campaign briefs`,
    `  • Content submission and review`,
    `  • Your Google Drive folder for assets`,
    ``,
    `Get started here: ${inviteUrl}`,
    ``,
    `This invite link is personal to you. If you already have an account, sign in with your existing password after following the link.`,
    ``,
    `— ${from}`,
  ].join("\n");

  const body = `
    <p style="margin:0 0 20px">Hi <strong>${influencerName}</strong>,</p>

    <p style="margin:0 0 20px">
      <strong>${from}</strong> has approved your collaboration and invited you
      to the <strong>IM8 Partner Portal</strong>.
    </p>

    <p style="margin:0 0 12px;font-size:14px;color:#5A000B;font-weight:600">Your portal gives you access to:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
      ${[
        "Your collaboration details and deliverables",
        "Campaign briefs from the IM8 team",
        "Content submission and feedback",
        "Your shared Google Drive folder for assets",
      ].map(item => `
        <tr>
          <td style="padding:4px 0;vertical-align:top">
            <span style="display:inline-block;width:20px;color:#A40011;font-weight:700">✓</span>
          </td>
          <td style="padding:4px 0;font-size:14px;color:#3D0010">${item}</td>
        </tr>`).join("")}
    </table>

    ${ctaButton("Access the Partner Portal →", inviteUrl)}

    <p style="margin:0;font-size:13px;color:#8C7A6E;border-top:1px solid #E1CBB9;padding-top:20px">
      This invite link is personal to you. If you already have an account,
      sign in with your existing password after following the link above.
    </p>

    <p style="margin:20px 0 0;font-size:14px;color:#5A000B;font-weight:600">— ${from}</p>
  `;

  const html = emailShell(body, { portalUrl: inviteUrl });

  return { subject, text, html };
}
