import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import InboxClient from "./inbox-client";

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  const { data: emails } = await admin
    .from("inbox_emails")
    .select("id, from_email, from_name, subject, body_text, received_at, is_read, linked_deal_id")
    .order("received_at", { ascending: false })
    .limit(100);

  // Fetch deal names for linked deals so we can show them in the UI
  const linkedIds = [...new Set((emails ?? []).map(e => e.linked_deal_id).filter(Boolean) as string[])];
  let dealNames: Record<string, string> = {};
  if (linkedIds.length > 0) {
    const { data: deals } = await admin
      .from("deals")
      .select("id, influencer_name")
      .in("id", linkedIds);
    dealNames = Object.fromEntries((deals ?? []).map(d => [d.id, d.influencer_name as string]));
  }

  const unreadCount = (emails ?? []).filter(e => !e.is_read).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-im8-burgundy">Partner Inbox</h1>
          {unreadCount > 0 && (
            <span className="px-2.5 py-1 bg-im8-red text-white text-xs font-bold rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <p className="text-im8-burgundy/60 mt-1 text-sm">
          Emails received at partners@im8health.com — synced automatically every 4 hours.
        </p>
      </div>

      <InboxClient emails={emails ?? []} dealNames={dealNames} />
    </div>
  );
}
