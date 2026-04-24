"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function DealDeleteButton({
  dealId,
  contractLabel,
}: {
  dealId: string;
  contractLabel: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete ${contractLabel}? This permanently removes the deal and all linked data. This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete deal.");
      setDeleting(false);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title={`Delete ${contractLabel}`}
      className="text-xs px-2 py-1 text-im8-burgundy/25 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
    >
      {deleting ? "…" : "🗑"}
    </button>
  );
}
