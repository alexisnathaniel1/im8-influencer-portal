import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import ReviewForm from "./review-form";

export default async function PublicReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ packetId: string }>;
  searchParams: Promise<{ token?: string; name?: string }>;
}) {
  const { packetId } = await params;
  const { token, name } = await searchParams;

  if (!token) notFound();

  const admin = createAdminClient();

  const { data: packet } = await admin
    .from("approval_packets")
    .select("id, title, review_token, status, deal_ids")
    .eq("id", packetId)
    .single();

  if (!packet || packet.review_token !== token) notFound();

  // Fetch full deal info so the review page can show details on demand.
  const { data: deals } = await admin
    .from("deals")
    .select("id, influencer_name, agency_name, platform_primary, monthly_rate_cents, total_months, rationale, deliverables, contract_sequence, instagram_handle, tiktok_handle, youtube_handle")
    .in("id", (packet.deal_ids ?? []) as string[]);

  // Fetch existing comments so the reviewer can see context
  const { data: comments } = await admin
    .from("approval_comments")
    .select("id, author_display_name, body, kind, created_at")
    .eq("packet_id", packetId)
    .order("created_at", { ascending: true });

  const senderName = process.env.APPROVAL_SENDER_NAME ?? "Diana";

  // Maintain the original deal order from packet.deal_ids
  const dealsById = Object.fromEntries((deals ?? []).map(d => [d.id, d]));
  const orderedDeals = ((packet.deal_ids ?? []) as string[])
    .map(id => dealsById[id])
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header — text wordmark on burgundy chip, matching the outbound email shell */}
        <div className="mb-10">
          <div className="inline-flex items-center justify-center bg-im8-burgundy rounded-xl px-5 py-3 mb-6">
            <span style={{ fontFamily: "Georgia, 'Times New Roman', serif" }} className="text-white text-2xl font-bold tracking-[0.15em]">I·M·8</span>
          </div>
          <p className="text-sm text-im8-burgundy/50 mb-1">{senderName} is asking for your review</p>
          <h1 className="text-3xl font-bold text-im8-maroon" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{packet.title}</h1>
        </div>

        {/* Per-creator review form (rewritten — one card per creator with
            collapsible details + per-creator decision buttons) */}
        <ReviewForm
          packetId={packetId}
          token={token}
          defaultName={name ?? ""}
          isClosed={packet.status === "approved" || packet.status === "rejected"}
          deals={orderedDeals as ReviewDeal[]}
          existingComments={(comments ?? []) as ReviewComment[]}
        />
      </div>
    </div>
  );
}

// Shared types so the client component knows the shape
export type ReviewDeal = {
  id: string;
  influencer_name: string;
  agency_name: string | null;
  platform_primary: string | null;
  monthly_rate_cents: number | null;
  total_months: number | null;
  rationale: string | null;
  deliverables: Array<{ code: string; count: number }> | null;
  contract_sequence: number | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
};
export type ReviewComment = {
  id: string;
  author_display_name: string | null;
  body: string;
  kind: string;
  created_at: string;
};
