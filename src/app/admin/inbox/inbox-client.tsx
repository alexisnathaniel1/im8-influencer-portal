"use client";

import { useState } from "react";
import { parseEmailBody, type ActionAssignee } from "@/lib/email/parse-body";
import { RenderedEmailBody } from "@/lib/email/render-body";

type InboxEmail = {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  body_text: string | null;
  received_at: string;
  is_read: boolean;
  linked_deal_id: string | null;
  ai_summary: string | null;
  ai_next_steps: string[] | null;
};

type LocalSummary = {
  summary: string;
  steps: { text: string; assignee: ActionAssignee }[];
};

const ASSIGNEE_META: Record<ActionAssignee, { label: string; classes: string; dot: string }> = {
  team:    { label: "Team",    classes: "bg-im8-red/10 text-im8-burgundy",   dot: "bg-im8-red" },
  creator: { label: "Creator", classes: "bg-violet-100 text-violet-800",     dot: "bg-violet-500" },
  fyi:     { label: "FYI",     classes: "bg-im8-stone/30 text-im8-muted",    dot: "bg-im8-stone" },
};

// Parse a "Team: do X" / "Creator: do Y" / "do Z" string into { text, assignee }
function parseStep(raw: string): { text: string; assignee: ActionAssignee } {
  const m = raw.match(/^\s*(team|creator|fyi)\s*[:\-–]\s*(.+)$/i);
  if (m) {
    return {
      text: m[2].trim(),
      assignee: m[1].toLowerCase() as ActionAssignee,
    };
  }
  return { text: raw.trim(), assignee: "team" };
}

function buildSummary(email: InboxEmail, override?: LocalSummary): LocalSummary | null {
  if (override) return override;
  if (email.ai_summary) {
    return {
      summary: email.ai_summary,
      steps: (email.ai_next_steps ?? []).map(parseStep),
    };
  }
  return null;
}

export default function InboxClient({
  emails,
  dealNames,
}: {
  emails: InboxEmail[];
  dealNames: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSig, setShowSig] = useState<Set<string>>(new Set());
  const [readSet, setReadSet] = useState<Set<string>>(
    new Set(emails.filter(e => e.is_read).map(e => e.id))
  );
  const [summaryOverrides, setSummaryOverrides] = useState<Record<string, LocalSummary>>({});
  const [generating, setGenerating] = useState<Set<string>>(new Set());

  async function markRead(id: string) {
    if (readSet.has(id)) return;
    setReadSet(prev => new Set([...prev, id]));
    await fetch(`/api/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    }).catch(console.error);
  }

  async function generateSummary(email: InboxEmail) {
    if (summaryOverrides[email.id] || email.ai_summary || generating.has(email.id)) return;
    setGenerating(prev => new Set([...prev, email.id]));
    try {
      const res = await fetch(`/api/inbox/${email.id}/summarize`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as { summary: string; next_steps: string[] };
      setSummaryOverrides(prev => ({
        ...prev,
        [email.id]: {
          summary: data.summary,
          steps: (data.next_steps ?? []).map(parseStep),
        },
      }));
    } finally {
      setGenerating(prev => { const s = new Set(prev); s.delete(email.id); return s; });
    }
  }

  function toggle(id: string, email: InboxEmail) {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next) {
      markRead(id);
      generateSummary(email);
    }
  }

  function toggleSig(id: string) {
    setShowSig(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-sm">No emails synced yet.</p>
        <p className="text-xs mt-1 text-im8-burgundy/30">
          Emails from partners@im8health.com sync every 4 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-im8-stone/30 overflow-hidden">
      <div className="divide-y divide-im8-stone/20">
        {emails.map(email => {
          const isRead = readSet.has(email.id);
          const isOpen = expanded === email.id;
          const sigOpen = showSig.has(email.id);
          const isGenerating = generating.has(email.id);
          const linkedDealName = email.linked_deal_id ? dealNames[email.linked_deal_id] : null;

          // For body display we still use parseEmailBody to strip signatures/quoted text
          const parsedBody = parseEmailBody(email.body_text, { fromEmail: email.from_email });
          // For summary + next steps, prefer AI if available, otherwise fall back to parsed
          const aiSummary = buildSummary(email, summaryOverrides[email.id]);
          const summaryText = aiSummary?.summary ?? parsedBody.summary;
          const steps = aiSummary
            ? aiSummary.steps
            : parsedBody.actionItems.map(a => ({ text: a.text, assignee: a.assignee }));
          const isAi = !!aiSummary;

          const receivedDate = new Date(email.received_at).toLocaleString("en-AU", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          });
          const fromDisplay = email.from_name
            ? `${email.from_name} <${email.from_email}>`
            : email.from_email;

          return (
            <div key={email.id} className={`transition-colors ${!isRead ? "bg-blue-50/20" : ""}`}>
              {/* ── Collapsed row ── */}
              <button
                onClick={() => toggle(email.id, email)}
                className="w-full text-left px-5 py-4 hover:bg-im8-offwhite transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    isRead ? "bg-transparent border border-im8-stone/40" : "bg-im8-red"
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${!isRead ? "font-semibold text-im8-burgundy" : "text-im8-burgundy/70"}`}>
                        {fromDisplay}
                      </span>
                      <span className="text-xs text-im8-burgundy/40 shrink-0">{receivedDate}</span>
                    </div>

                    <p className={`text-sm mt-0.5 ${!isRead ? "font-medium text-im8-burgundy" : "text-im8-burgundy/60"}`}>
                      {email.subject}
                    </p>

                    {summaryText && (
                      <p className="text-xs text-im8-muted mt-1 leading-relaxed line-clamp-2">
                        {summaryText}
                      </p>
                    )}

                    {steps.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {steps.map((step, i) => {
                          const meta = ASSIGNEE_META[step.assignee];
                          return (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${meta.classes}`}
                              title={step.text}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              <span className="opacity-70 font-bold">{meta.label}</span>
                              <span className="truncate max-w-[260px]">{step.text}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {linkedDealName && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-im8-burgundy/10 text-im8-burgundy font-medium mt-1.5">
                        🔗 {linkedDealName}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* ── Expanded view ── */}
              {isOpen && (
                <div className="px-10 pb-7 pt-2 space-y-5 bg-im8-offwhite/30">
                  {/* AI summary card */}
                  <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-im8-muted">
                        {isAi ? "AI Summary" : "Summary"}
                      </p>
                      {isGenerating && (
                        <span className="flex items-center gap-1.5 text-[11px] text-im8-muted">
                          <span className="w-3 h-3 rounded-full border-2 border-im8-burgundy/30 border-t-im8-burgundy animate-spin" />
                          Generating…
                        </span>
                      )}
                      {isAi && !isGenerating && (
                        <span className="text-[10px] font-semibold text-im8-gold uppercase tracking-wider">✦ Gemini</span>
                      )}
                    </div>

                    {summaryText ? (
                      <p className="text-[14px] text-im8-burgundy leading-relaxed">{summaryText}</p>
                    ) : (
                      <p className="text-sm text-im8-muted italic">No summary available yet.</p>
                    )}

                    {steps.length > 0 && (
                      <div className="pt-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-im8-muted mb-2">
                          Next Steps
                        </p>
                        <ul className="space-y-2">
                          {steps.map((step, i) => {
                            const meta = ASSIGNEE_META[step.assignee];
                            return (
                              <li key={i} className="flex items-start gap-3">
                                <span
                                  className={`shrink-0 mt-0.5 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${meta.classes}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                  {meta.label}
                                </span>
                                <span className="text-[14px] text-im8-burgundy leading-relaxed">{step.text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Sender + meta strip */}
                  <div className="flex items-center justify-between gap-4 px-1">
                    <div>
                      <p className="text-[10px] text-im8-muted font-bold uppercase tracking-wider">From</p>
                      <p className="text-sm text-im8-burgundy mt-0.5">{fromDisplay}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-im8-muted font-bold uppercase tracking-wider">Received</p>
                      <p className="text-sm text-im8-burgundy mt-0.5">{receivedDate}</p>
                    </div>
                  </div>

                  {/* Email body card */}
                  <div className="bg-white rounded-xl border border-im8-stone/30 shadow-sm">
                    <div className="px-6 py-5 max-h-[480px] overflow-y-auto">
                      {parsedBody.bodyClean ? (
                        <RenderedEmailBody text={parsedBody.bodyClean} />
                      ) : (
                        <p className="text-sm text-im8-muted italic">(No message body)</p>
                      )}

                      {parsedBody.signature && (
                        <div className="mt-5 pt-4 border-t border-im8-stone/30">
                          <button
                            type="button"
                            onClick={() => toggleSig(email.id)}
                            className="text-[11px] font-semibold text-im8-muted hover:text-im8-burgundy uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                          >
                            <span className={`inline-block transition-transform ${sigOpen ? "rotate-90" : ""}`}>›</span>
                            {sigOpen ? "Hide signature" : "Show signature"}
                          </button>
                          {sigOpen && (
                            <div className="mt-3 opacity-70">
                              <RenderedEmailBody text={parsedBody.signature} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Link to deal */}
                  <div className="flex items-center gap-3 px-1">
                    <p className="text-[11px] text-im8-muted uppercase tracking-wider font-semibold shrink-0">
                      Link to deal
                    </p>
                    <select
                      defaultValue={email.linked_deal_id ?? ""}
                      onChange={async e => {
                        const val = e.target.value || null;
                        await fetch(`/api/inbox/${email.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ linked_deal_id: val }),
                        });
                      }}
                      className="text-sm border border-im8-stone/40 rounded-lg px-3 py-1.5 text-im8-burgundy bg-white focus:outline-none focus:ring-2 focus:ring-im8-red/30"
                    >
                      <option value="">— No deal linked —</option>
                      {Object.entries(dealNames).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
