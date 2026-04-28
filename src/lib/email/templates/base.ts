/**
 * Shared email shell — wraps every IM8 outbound email in the same branded
 * container: burgundy header with I·M·8 wordmark, white body, stone footer.
 *
 * All styling is inline (required for email-client compatibility).
 */
export function emailShell(body: string, opts: { portalUrl?: string | null } = {}): string {
  const { portalUrl } = opts;
  const dashboardHref = portalUrl ?? "https://portal.im8health.com";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
</head>
<body style="margin:0;padding:0;background:#FAF6F2;-webkit-font-smoothing:antialiased">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAF6F2;padding:40px 16px">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(80,0,11,0.10)">

          <!-- Header -->
          <tr>
            <td style="background:#50000B;padding:28px 40px;text-align:center">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;color:#ffffff;letter-spacing:0.15em;margin:0">I·M·8</div>
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;color:#FF9693;letter-spacing:0.25em;text-transform:uppercase;margin-top:5px">INFLUENCER PORTAL</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1A0508">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#FAF6F2;border-top:1px solid #E1CBB9;padding:20px 40px">
              <p style="margin:0;font-size:12px;color:#8C7A6E;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
                IM8 Health &nbsp;·&nbsp; <a href="https://im8health.com" style="color:#A40011;text-decoration:none">im8health.com</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#B09888;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
                Please do not reply to this email — all communication goes through your
                <a href="${dashboardHref}" style="color:#A40011;text-decoration:none">IM8 dashboard</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Full-width pill CTA button */
export function ctaButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0">
      <tr>
        <td align="center">
          <a href="${href}"
             style="display:inline-block;background:#50000B;color:#ffffff;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.03em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

/** A tinted card for proposals / key info blocks */
export function infoCard(content: string): string {
  return `
    <div style="background:#FAF6F2;border:1px solid #E1CBB9;border-radius:12px;padding:24px 28px;margin:24px 0">
      ${content}
    </div>`;
}

/** Micro uppercase section label */
export function sectionLabel(text: string): string {
  return `<p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#8C7A6E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${text}</p>`;
}
