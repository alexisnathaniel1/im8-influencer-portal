"use client";

import { useState } from "react";

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
          <br />Admins can also trigger a manual sync via the API.
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
          const receivedDate = new Date(email.received_at).toLocaleString("en-AU", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          });
          const fromDisplay = email.from_name
            ? `${email.from_name} <${email.from_email}>`
            : email.from_email;

          return (
            <div key={email.id} className={`transition-colors ${!isRead ? "bg-blue-50/30" : ""}`}>
              {/* Email row header */}
              <button
                onClick={() => toggle(email.id)}
                className="w-full text-left px-5 py-4 hover:bg-im8-offwhite transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Unread dot */}
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 transition-colors ${
                    isRead ? "bg-transparent border border-im8-stone/40" : "bg-im8-red"
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between flex-wrap">
                      <span className={`text-sm truncate ${!isRead ? "font-semibold text-im8-burgundy" : "text-im8-burgundy/70"}`}>
                        {fromDisplay}
                      </span>
                      <span className="text-xs text-im8-burgundy/40 shrink-0">{receivedDate}</span>
                    </div>
                    <p className={`text-sm mt-0.5 truncate ${!isRead ? "font-medium text-im8-burgundy" : "text-im8-burgundy/60"}`}>
                      {email.subject}
                    </p>
                    {linkedDealName && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-im8-burgundy/10 text-im8-burgundy font-medium mt-1">
                        🔗 {linkedDealName}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded body */}
              {isOpen && (
                <div className="px-10 pb-5 pt-1">
                  <div className="bg-im8-offwhite rounded-lg px-5 py-4 mb-3">
                    <p className="text-xs text-im8-muted font-medium mb-1">From</p>
                    <p className="text-sm text-im8-burgundy">{fromDisplay}</p>
                  </div>

                  <div className="bg-white border border-im8-stone/20 rounded-lg px-5 py-4 mb-4">
                    <p className="text-sm text-im8-burgundy/80 whitespace-pre-wrap leading-relaxed">
                      {email.body_text ?? "(no body)"}
                    </p>
                  </div>

                  {/* Link to deal */}
                  <div className="flex items-center gap-3">
                    <p className="text-[11px] text-im8-muted uppercase tracking-wider font-semibold">Link to deal</p>
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
