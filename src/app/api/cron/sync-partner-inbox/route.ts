import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Find the highest UID already stored so we only fetch newer messages
  const { data: latest } = await admin
    .from("inbox_emails")
    .select("imap_uid")
    .eq("imap_account", imapUser)
    .order("imap_uid", { ascending: false })
    .limit(1)
    .single();

  const sinceUid = ((latest as { imap_uid: number } | null)?.imap_uid ?? 0) + 1;

  let fetched = 0;
  let inserted = 0;

  try {
    // Dynamic import — avoids bundling issues in Next.js edge/RSC contexts
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
      // Fetch messages with UID >= sinceUid (up to 50 at a time to stay within function limits)
      const sequence = `${sinceUid}:${sinceUid + 49}`;

      for await (const msg of client.fetch(
        { uid: sequence },
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
            // Truncate body to 8k chars to keep rows manageable
            body_text: parsed.text ? parsed.text.slice(0, 8000) : null,
            received_at: (parsed.date ?? new Date()).toISOString(),
          });
        } catch (parseErr) {
          console.error(`[sync-inbox] Failed to parse UID ${msg.uid}:`, parseErr);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    if (rows.length > 0) {
      const { error, count } = await admin
        .from("inbox_emails")
        .upsert(rows, { onConflict: "imap_account,imap_uid", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("[sync-inbox] DB upsert failed:", error.message);
      } else {
        inserted = count ?? rows.length;
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
