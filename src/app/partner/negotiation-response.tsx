"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NegotiationResponse({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accepted" | "declined" | null>(null);

  async function respond(response: "accepted" | "declined") {
    setLoading(response);
    await fetch(`/api/discovery/${profileId}/negotiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={() => respond("accepted")}
        disabled={loading !== null}
        className="flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {loading === "accepted" ? "Saving…" : "Accept proposal"}
      </button>
      <button
        onClick={() => respond("declined")}
        disabled={loading !== null}
        className="flex-1 py-2 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {loading === "declined" ? "Saving…" : "Decline"}
      </button>
    </div>
  );
}
