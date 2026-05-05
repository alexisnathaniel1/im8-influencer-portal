import React from "react";

/**
 * Render plain-text email content with light formatting:
 * - Paragraphs split on blank lines
 * - *text* rendered as <strong>
 * - http(s) URLs rendered as links
 * - Single newlines inside a paragraph rendered as <br />
 *
 * No external markdown library — this is intentional, emails are plain text.
 */
export function RenderedEmailBody({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const paragraphs = text.split(/\n\s*\n+/);
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-[14px] leading-[1.65] text-im8-burgundy/90">
          {renderInline(p)}
        </p>
      ))}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  // First split on single newlines to preserve in-paragraph breaks
  const lines = text.split("\n");
  return lines.flatMap((line, lineIdx) => {
    const parts = renderInlineFormatting(line, `${lineIdx}`);
    if (lineIdx < lines.length - 1) {
      return [...parts, <br key={`br-${lineIdx}`} />];
    }
    return parts;
  });
}

function renderInlineFormatting(line: string, keyPrefix: string): React.ReactNode[] {
  // Tokenize on *bold* and URLs simultaneously
  const tokenRe = /(\*[^\*\n]+\*)|((?:https?:\/\/|www\.)[^\s<>"]+)/g;
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = tokenRe.exec(line)) !== null) {
    if (match.index > lastIdx) {
      out.push(<span key={`${keyPrefix}-t-${i++}`}>{line.slice(lastIdx, match.index)}</span>);
    }

    if (match[1]) {
      // *bold*
      out.push(
        <strong key={`${keyPrefix}-b-${i++}`} className="font-semibold text-im8-burgundy">
          {match[1].slice(1, -1)}
        </strong>
      );
    } else if (match[2]) {
      // url
      const raw = match[2];
      const href = raw.startsWith("http") ? raw : `https://${raw}`;
      out.push(
        <a
          key={`${keyPrefix}-l-${i++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-im8-red underline underline-offset-2 hover:text-im8-burgundy"
        >
          {raw}
        </a>
      );
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < line.length) {
    out.push(<span key={`${keyPrefix}-t-${i++}`}>{line.slice(lastIdx)}</span>);
  }
  return out.length > 0 ? out : [<span key={`${keyPrefix}-empty`}>{line}</span>];
}
