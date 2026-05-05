"use client";

import { useState } from "react";
import { parseEmailBody } from "@/lib/email/parse-body";

type InboxEmail = {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  body_text: string | null;
  received_at: string;
  is_read: boolean;
  linked_deal_id: string | null;
};

export default function InboxClient({
  emails,
  dealNames,
}: {
  emails: InboxEmail[];
  dealNames: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [readSet, setReadSet] = useState<Set<string>>(
    new Set(emails.filter(e => e.is_read).map(e => e.id))
  );

  async function markRead(id: string) {
    if (readSet.has(id)) return;
    setReadSet(prev => new Set([...prev, id]));
    await fetch(`/api/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    }).catch(console.error);
  }

  function toggle(id: string) {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next) markRead(id);
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
          const linkedDealName = email.linked_deal_id ? dealNames[email.linked_deal_id] : null;
          const { summary, nextSteps } = parseEmailBody(email.body_text);
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
                onClick={() => toggle(email.id)}
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

                    {/* Summary snippet */}
                    {summary && (
                      <p className="text-xs text-im8-muted mt-1 leading-relaxed line-clamp-2">
                        {summary}
                      </p>
                    )}

                    {/* Next steps extracted from body */}
                    {nextSteps.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {nextSteps.map((step, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <p className="text-[11px] text-amber-800 leading-relaxed">{step}</p>
                          </div>
                        ))}
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
                <div className="px-10 pb-6 pt-1 space-y-4">
                  {/* Summary + next steps banner */}
                  {(summary || nextSteps.length > 0) && (
                    <div className="bg-im8-offwhite rounded-xl px-5 py-4 space-y-3">
                      {summary && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-im8-muted mb-1">Summary</p>
                          <p className="text-sm text-im8-burgundy leading-relaxed">{summary}</p>
                        </div>
                      )}
                      {nextSteps.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-im8-muted mb-2">Action Items</p>
                          <ul className="space-y-1.5">
                            {nextSteps.map((step, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                <span className="text-sm text-im8-burgundy leading-relaxed">{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* From */}
                  <div className="bg-im8-offwhite rounded-lg px-4 py-3">
                    <p className="text-[10px] text-im8-muted font-bold uppercase tracking-wider mb-0.5">From</p>
                    <p className="text-sm text-im8-burgundy">{fromDisplay}</p>
                  </div>

                  {/* Full body */}
                  <div className="bg-white border border-im8-stone/20 rounded-lg px-5 py-4 max-h-[480px] overflow-y-auto">
                    <p className="text-[10px] text-im8-muted font-bold uppercase tracking-wider mb-2">Full Email</p>
                    <p className="text-sm text-im8-burgundy/80 whitespace-pre-wrap leading-relaxed">
                      {email.body_text ?? "(no body)"}
                    </p>
                  </div>

                  {/* Link to deal */}
                  <div className="flex items-center gap-3">
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
