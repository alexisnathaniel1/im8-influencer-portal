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
    `• Your collaboration details and deliverables`,
    `• Campaign briefs`,
    `• Content submission and review`,
    `• Your Google Drive folder for assets`,
    ``,
    `Get started here: ${inviteUrl}`,
    ``,
    `This invite link is personal to you. If you already have an account, just sign in with your existing password.`,
    ``,
    `— ${from}`,
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,system-ui,sans-serif;color:#3a1e1e;max-width:560px">
      <p>Hi <strong>${influencerName}</strong>,</p>
      <p><strong>${from}</strong> has approved your collaboration and invited you to the IM8 Partner Portal.</p>
      <p>Your portal gives you access to:</p>
      <ul style="padding-left:20px;line-height:1.8">
        <li>Your collaboration details and deliverables</li>
        <li>Campaign briefs</li>
        <li>Content submission and review</li>
        <li>Your Google Drive folder for assets</li>
      </ul>
      <p style="margin:24px 0">
        <a href="${inviteUrl}"
          style="background:#8B1A1A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Access the Partner Portal →
        </a>
      </p>
      <p style="color:#8a6a6a;font-size:13px">
        This invite link is personal to you. If you already have an account, just sign in with your existing password after following the link.
      </p>
      <p style="color:#8a6a6a;font-size:12px">— ${from}</p>
    </div>
  `;

  return { subject, text, html };
}
