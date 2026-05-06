/**
 * Slack Incoming Webhook notifications for the IM8 influencer portal.
 *
 * Set SLACK_WEBHOOK_URL in your environment to enable notifications.
 * If the env var is absent the function is a no-op — safe in all environments.
 *
 * All calls are fire-and-forget. Never await this in a request handler;
 * wrap in next/server `after()` or call as `void slackNotify(...)`.
 */

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://im8-influencer-portal.vercel.app";

export async function slackNotify(
  text: string,
  blocks?: object[],
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // graceful no-op when not configured

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
    });
  } catch (e) {
    // Never let a Slack failure break the main request flow
    console.error("[slack/notify] Failed to post to Slack:", e);
  }
}

// ─── Typed event helpers ──────────────────────────────────────────────────────

/** Brief sent to a creator. */
export function notifyBriefSent(opts: {
  influencerName: string;
  deliverableLabel: string; // e.g. "IGR #2"
  adminName: string;
  dealId: string;
}) {
  const url = `${PORTAL_URL}/admin/deals/${opts.dealId}`;
  void slackNotify(
    `📨 *Brief sent* — ${opts.influencerName} · ${opts.deliverableLabel} — sent by ${opts.adminName}`,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📨 *Brief sent*\n*Creator:* ${opts.influencerName}\n*Deliverable:* ${opts.deliverableLabel}\n*Sent by:* ${opts.adminName}`,
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "View deal →" },
          url,
        },
      },
    ],
  );
}

/** Creator submitted content for review. */
export function notifyContentSubmitted(opts: {
  influencerName: string;
  deliverableLabel: string;
  draftNumber: number;
  dealId: string;
}) {
  const url = `${PORTAL_URL}/admin/review`;
  void slackNotify(
    `📥 *New submission* — ${opts.influencerName} submitted ${opts.deliverableLabel} (Draft ${opts.draftNumber})`,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📥 *New submission*\n*Creator:* ${opts.influencerName}\n*Deliverable:* ${opts.deliverableLabel}\n*Draft:* #${opts.draftNumber}`,
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Review now →" },
          url,
        },
      },
    ],
  );
}

/** Admin approved a submission. */
export function notifyContentApproved(opts: {
  influencerName: string;
  deliverableLabel: string;
  adminName: string;
  dealId: string;
}) {
  const url = `${PORTAL_URL}/admin/deals/${opts.dealId}`;
  void slackNotify(
    `✅ *Approved* — ${opts.influencerName} · ${opts.deliverableLabel} approved by ${opts.adminName}`,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Approved*\n*Creator:* ${opts.influencerName}\n*Deliverable:* ${opts.deliverableLabel}\n*Approved by:* ${opts.adminName}`,
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "View deal →" },
          url,
        },
      },
    ],
  );
}

/** Admin requested a revision. */
export function notifyRevisionRequested(opts: {
  influencerName: string;
  deliverableLabel: string;
  adminName: string;
  feedbackPreview: string | null;
  dealId: string;
}) {
  const preview = opts.feedbackPreview
    ? `\n*Feedback:* ${opts.feedbackPreview.slice(0, 120)}${opts.feedbackPreview.length > 120 ? "…" : ""}`
    : "";
  const url = `${PORTAL_URL}/admin/review`;
  void slackNotify(
    `🔁 *Revision requested* — ${opts.influencerName} · ${opts.deliverableLabel}`,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔁 *Revision requested*\n*Creator:* ${opts.influencerName}\n*Deliverable:* ${opts.deliverableLabel}\n*By:* ${opts.adminName}${preview}`,
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Review queue →" },
          url,
        },
      },
    ],
  );
}
