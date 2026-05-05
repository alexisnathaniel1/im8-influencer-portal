/**
 * Pure text parsing — no external AI.
 * Strips quoted replies and signatures, then extracts:
 *   - summary: first 2 meaningful sentences of the email body
 *   - nextSteps: any sentences that are questions or contain action requests
 */
export function parseEmailBody(bodyText: string | null): {
  summary: string;
  nextSteps: string[];
} {
  if (!bodyText) return { summary: "", nextSteps: [] };

  const lines = bodyText.split(/\r?\n/);

  // 1. Drop quoted-reply lines (starting with >)
  const nonQuoted = lines.filter(l => !l.trim().startsWith(">"));

  // 2. Cut at signature boundary
  const SIG = /^(--|Best(?:\s+regards)?,?|Kind regards,?|Regards,?|Thanks,?|Thank you,?|Cheers,?|Sincerely,?|Warm regards,?|Speak soon,?)/i;
  const sigIdx = nonQuoted.findIndex(l => SIG.test(l.trim()));
  const content = sigIdx > 2 ? nonQuoted.slice(0, sigIdx) : nonQuoted;

  // 3. Skip opening greeting line
  const GREETING = /^(Hi|Hello|Hey|Dear|Good morning|Good afternoon)\b/i;
  const bodyLines = content.map(l => l.trim()).filter(l => l.length > 0);
  const start = bodyLines.findIndex(l => !GREETING.test(l));
  const meaningful = bodyLines.slice(start >= 0 ? start : 0);

  // 4. Build full paragraph text
  const fullText = meaningful.join(" ").replace(/\s+/g, " ").trim();

  // 5. Split into sentences
  const sentences = fullText.match(/[^.!?]+[.!?]+/g) ?? [fullText];

  // 6. Summary = first 2 sentences, capped at 220 chars
  const rawSummary = sentences.slice(0, 2).join(" ").trim();
  const summary =
    rawSummary.length > 220
      ? rawSummary.slice(0, 220).replace(/\s\S+$/, "") + "…"
      : rawSummary;

  // 7. Next steps = sentences that are questions or contain action verbs
  const ACTION = /\b(please|could you|can you|would you|let me know|send|confirm|review|schedule|follow.?up|reach out|interested|looking forward|happy to|love to|great if|hoping|wondering)\b/i;
  const nextSteps = sentences
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 220 && (s.endsWith("?") || ACTION.test(s)))
    .slice(0, 3);

  return { summary, nextSteps };
}
