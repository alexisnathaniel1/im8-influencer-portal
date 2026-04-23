import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Image from "next/image";
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

  // Fetch the deals in this packet
  const { data: deals } = await admin
    .from("deals")
    .select("id, influencer_name, platform_primary, rationale")
    .in("id", packet.deal_ids as string[]);

  // Fetch existing comments so the reviewer can see context
  const { data: comments } = await admin
    .from("approval_comments")
    .select("id, author_display_name, body, kind, created_at")
    .eq("packet_id", packetId)
    .order("created_at", { ascending: true });

  const senderName = process.env.APPROVAL_SENDER_NAME ?? "Diana";

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Image src="/logo.svg" alt="IM8" width={60} height={30} className="mb-6" />
          <p className="text-sm text-im8-burgundy/50 mb-1">{senderName} is asking for your review</p>
          <h1 className="text-2xl font-bold text-im8-burgundy">{packet.title}</h1>
        </div>

        {/* Influencer list */}
        <div className="bg-white rounded-xl border border-im8-stone/20 p-5 mb-6">
          <h2 className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide mb-3">
            Partnerships in this batch
          </h2>
          <div className="space-y-3">
            {(deals ?? []).map(d => (
              <div key={d.id} className="flex items-start gap-3">
                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-im8-red shrink-0" />
                <div>
                  <div className="font-medium text-im8-burgundy text-sm">{d.influencer_name}</div>
                  {d.rationale && (
                    <p className="text-xs text-im8-burgundy/50 mt-0.5">{d.rationale}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prior comments */}
        {(comments ?? []).length > 0 && (
          <div className="bg-white rounded-xl border border-im8-stone/20 p-5 mb-6">
            <h2 className="text-xs font-semibold text-im8-burgundy/50 uppercase tracking-wide mb-3">
              Comments so far
            </h2>
            <div className="space-y-3">
              {(comments ?? []).map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-im8-sand flex items-center justify-center text-xs font-bold text-im8-burgundy shrink-0">
                    {c.author_display_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-im8-burgundy">{c.author_display_name}</span>
                      {c.kind !== "comment" && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          c.kind === "approval" ? "bg-green-100 text-green-700" :
                          c.kind === "rejection" ? "bg-red-100 text-red-600" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {c.kind === "approval" ? "Approved" : c.kind === "rejection" ? "Rejected" : "Revision requested"}
                        </span>
                      )}
                      <span className="text-xs text-im8-burgundy/30">
                        {new Date(c.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <p className="text-sm text-im8-burgundy/70">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review form */}
        <ReviewForm
          packetId={packetId}
          token={token}
          defaultName={name ?? ""}
          isClosed={packet.status === "approved" || packet.status === "rejected"}
        />
      </div>
    </div>
  );
}
