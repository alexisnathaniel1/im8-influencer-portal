import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeEmail } from "@/lib/ai/email-summary";

// Vercel cron: runs every 4 hours — secured by Authorization: Bearer CRON_SECRET
// Fetches new emails from partners@im8health.com via IMAP and stores them in inbox_emails.
export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const imapUser = process.env.INBOX_USER;
  const imapPass = process.env.INBOX_PASS;

  if (!imapUser || !imapPass) {
    console.warn("[sync-inbox] INBOX_USER or INBOX_PASS not set — skipping");
    return NextResponse.json({ ok: true, skipped: "credentials not configured" });
  }

  const admin = createAdminClient();

  // Use the most recent received_at stored to set the IMAP search window.
  // On first run: sync the last 60 days so we get recent emails, not the oldest.
  const { data: latestStored } = await admin
    .from("inbox_emails")
    .select("received_at")
    .eq("imap_account", imapUser)
    .order("received_at", { ascending: false })
    .limit(1)
    .single();

  const sinceDate = latestStored?.received_at
    ? new Date(new Date(latestStored.received_at as string).getTime() - 60 * 60 * 1000) // 1h overlap to avoid gaps
    : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago on first run

  let fetched = 0;
  let inserted = 0;

  try {
    const { ImapFlow } = await import("imapflow");
    const { simpleParser } = await import("mailparser");

    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      logger: false,
    });

    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    const rows: Array<{
      imap_uid: number;
      imap_account: string;
      from_email: string;
      from_name: string | null;
      subject: string;
      body_text: string | null;
      received_at: string;
    }> = [];

    try {
      // Search by date so we always get recent emails (not oldest-first by UID)
      const uidResult = await client.search({ since: sinceDate }, { uid: true });
      const uids: number[] = Array.isArray(uidResult) ? uidResult : [];

      // Take the most recent 100 (highest UIDs = newest)
      const recentUids = uids.slice(-100);

      if (recentUids.length > 0) {
        const uidRange = recentUids.join(",");
        for await (const msg of client.fetch(
          { uid: uidRange },
          { envelope: true, source: true },
          { uid: true },
        )) {
          fetched++;
          if (!msg.source) continue;
          try {
            const parsed = await (simpleParser as (source: Buffer | string) => Promise<import("mailparser").ParsedMail>)(msg.source);
            const fromAddr = parsed.from?.value?.[0];
            rows.push({
              imap_uid: msg.uid,
              imap_account: imapUser,
              from_email: fromAddr?.address ?? "",
              from_name: fromAddr?.name ?? null,
              subject: parsed.subject ?? "(no subject)",
              body_text: parsed.text ? parsed.text.slice(0, 8000) : null,
              received_at: (parsed.date ?? new Date()).toISOString(),
            });
          } catch (parseErr) {
            console.error(`[sync-inbox] Failed to parse UID ${msg.uid}:`, parseErr);
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    if (rows.length > 0) {
      const { data: insertedRows, error, count } = await admin
        .from("inbox_emails")
        .upsert(rows, { onConflict: "imap_account,imap_uid", ignoreDuplicates: true })
        .select("id, from_email, from_name, subject, body_text");

      if (error) {
        console.error("[sync-inbox] DB upsert failed:", error.message);
      } else {
        inserted = count ?? rows.length;

        // Summarize each new email sequentially. Errors are non-fatal — the email
        // is still saved without a summary and can be summarized on-demand later.
        if (insertedRows && insertedRows.length > 0) {
          console.log(`[sync-inbox] Summarizing ${insertedRows.length} new emails…`);
          for (const row of insertedRows) {
            try {
              const summary = await summarizeEmail({
                from_name: row.from_name as string | null,
                from_email: row.from_email as string,
                subject: row.subject as string,
                body_text: row.body_text as string | null,
              });
              if (summary) {
                await admin
                  .from("inbox_emails")
                  .update({ ai_summary: summary.summary, ai_next_steps: summary.next_steps })
                  .eq("id", row.id);
              }
            } catch (sumErr) {
              console.error(`[sync-inbox] summary failed for ${row.id}:`, sumErr);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[sync-inbox] IMAP connection failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  console.log(`[sync-inbox] Fetched ${fetched}, inserted ${inserted} emails from ${imapUser}`);
  return NextResponse.json({ ok: true, fetched, inserted });
}
