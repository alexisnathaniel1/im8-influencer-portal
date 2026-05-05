/**
 * Pure text parsing — no external AI.
 *
 * Splits an email body into:
 *   - summary:     1–2 sentence overview, signature stripped
 *   - actionItems: sentences asking the recipient to do something, with assignee
 *   - bodyClean:   the actual message (no signature, no quoted reply text)
 *   - signature:   the sign-off + name + titles + footer
 */

export type ActionAssignee = "team" | "creator" | "fyi";

export type ActionItem = {
  text: string;
  assignee: ActionAssignee;
};

export type ParsedEmail = {
  summary: string;
  actionItems: ActionItem[];
  bodyClean: string;
  signature: string;
};

// Sign-off patterns — match a whole line on its own.
const SIGN_OFFS = [
  /^--\s*$/,
  /^[-=_]{3,}\s*$/, // divider lines
  /^(?:Best(?:\s+regards)?|Kind\s+regards|Regards|Thanks(?:\s+(?:so\s+)?much)?|Many\s+thanks|Thank\s+you|Cheers|Sincerely|Warm(?:est)?\s+regards|Speak\s+soon|Talk\s+soon|With\s+Health|All\s+the\s+best|Yours(?:\s+truly)?|Looking\s+forward)[,.!]?\s*$/i,
  /^Sent\s+from\s+my\s+(?:iPhone|iPad|Android|mobile)\s*$/i,
];

const GREETING = /^(?:Hi|Hello|Hey|Dear|Good\s+(?:morning|afternoon|evening))\b[^.!?]*[,.:]?\s*$/i;

// Forwarded / Reply markers — everything below these we drop from cleanBody
const FORWARD_MARKER = /^(?:-{2,}|=+)\s*Forwarded\s+message\s*-{2,}=*\s*$/i;
const ON_WROTE = /^On\s+.+\s+wrote:\s*$/;

// Action / question patterns
const QUESTION_END = /\?$/;
const ACTION_VERB =
  /\b(please|kindly|could\s+you|can\s+you|would\s+you|can\s+we|let\s+(?:me|us)\s+know|let\s+me\s+know|reach\s+out|get\s+back\s+to|follow\s+up|check\s+(?:that|to|whether|if)|confirm|approve|review|send\s+(?:over|across|me|us)|share|provide|forward|reply|respond)\b/i;

// "I'll" / "We'll" — sender is committing, not asking us — skip these.
const SENDER_COMMITTING =
  /^(?:I[' ]?(?:ll|m\s+going\s+to|\s+will)|we[' ]?(?:ll|re\s+going\s+to|\s+will))\b/i;

// Internal IM8 domains — used to decide assignee context
const INTERNAL_DOMAINS = ["prenetics.com", "im8health.com"];

function isInternalSender(email?: string | null): boolean {
  if (!email) return false;
  return INTERNAL_DOMAINS.some(d => email.toLowerCase().endsWith("@" + d));
}

// Detect a markdown-style signature block, e.g.:
//   *Samantha Kwok*
//   *Chief of Staff to Group CEO*
//   *VP, Operations*
function looksLikeMarkdownSigBlock(line: string, next?: string): boolean {
  const isMdLine = /^\*[^*]{2,}\*\s*$/.test(line.trim());
  if (!isMdLine) return false;
  // If the next non-empty line is also a *...* block, this is signature.
  if (next && /^\*[^*]{2,}\*\s*$/.test(next.trim())) return true;
  return isMdLine; // single *Name* on its own can also be signature start
}

function findSignatureIndex(lines: string[]): number {
  // Skip the first line (often greeting) when scanning for sign-offs
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (SIGN_OFFS.some(p => p.test(trimmed))) return i;
  }
  // Look for a markdown sig block
  for (let i = 1; i < lines.length; i++) {
    if (looksLikeMarkdownSigBlock(lines[i], lines[i + 1])) return i;
  }
  return -1;
}

function findFooterIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (FORWARD_MARKER.test(lines[i].trim())) return i;
    if (ON_WROTE.test(lines[i].trim())) return i;
  }
  return -1;
}

function splitSentences(text: string): string[] {
  if (!text) return [];
  // Match runs ending in . ! ? — also keep multi-sentence runs intact
  const matches = text.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  return (matches ?? [text]).map(s => s.trim()).filter(Boolean);
}

function classifyAssignee(sentence: string, fromInternal: boolean): ActionAssignee | null {
  // If sender is committing to do something themselves, skip it
  if (SENDER_COMMITTING.test(sentence.trim())) return null;

  // Anything addressed to "you" / "please" / "could you" → team
  if (/\b(?:please|could\s+you|can\s+you|would\s+you|let\s+me\s+know|reach\s+out)\b/i.test(sentence))
    return "team";

  // From internal sender giving instructions → team
  if (fromInternal && /\b(?:we\s+(?:need|should)|let'?s|please)\b/i.test(sentence))
    return "team";

  // Questions → team
  if (sentence.endsWith("?")) return "team";

  return "team"; // default — these are received emails, so the team usually owns it
}

export function parseEmailBody(
  bodyText: string | null,
  opts?: { fromEmail?: string | null }
): ParsedEmail {
  if (!bodyText) return { summary: "", actionItems: [], bodyClean: "", signature: "" };

  const fromInternal = isInternalSender(opts?.fromEmail);

  // Normalise newlines and drop quoted-reply lines (>) up-front
  const allLines = bodyText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter(l => !l.trim().startsWith(">"));

  // Cut at "On X wrote:" / "Forwarded message" markers
  const footerIdx = findFooterIndex(allLines);
  const aboveFooter = footerIdx >= 0 ? allLines.slice(0, footerIdx) : allLines;

  // Cut at signature
  const sigIdx = findSignatureIndex(aboveFooter);
  const bodyLines = sigIdx >= 0 ? aboveFooter.slice(0, sigIdx) : aboveFooter;
  const sigLines = sigIdx >= 0 ? aboveFooter.slice(sigIdx) : [];

  const bodyClean = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const signature = sigLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // Build summary text — drop greeting line if present
  const meaningfulLines = bodyLines
    .map(l => l.trim())
    .filter(l => l.length > 0 && !GREETING.test(l));
  const fullText = meaningfulLines.join(" ").replace(/\s+/g, " ").trim();

  const sentences = splitSentences(fullText);

  // Summary = first 2 sentences, capped at 220 chars
  const rawSummary = sentences.slice(0, 2).join(" ").trim() || fullText;
  const summary =
    rawSummary.length > 220
      ? rawSummary.slice(0, 220).replace(/\s\S+$/, "") + "…"
      : rawSummary;

  // Action items
  const actionItems: ActionItem[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    if (s.length < 12 || s.length > 240) continue;
    const isAction = QUESTION_END.test(s) || ACTION_VERB.test(s);
    if (!isAction) continue;
    const assignee = classifyAssignee(s, fromInternal);
    if (!assignee) continue;

    // Dedupe near-identical sentences (often happens with quoted replies)
    const key = s.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);

    actionItems.push({ text: s, assignee });
    if (actionItems.length >= 3) break;
  }

  return { summary, actionItems, bodyClean, signature };
}
