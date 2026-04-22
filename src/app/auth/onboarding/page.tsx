"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"profile" | "folder">("profile");
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const ADMIN_DOMAINS = ["@prenetics.com", "@im8health.com"];
    const isAdminEmail = ADMIN_DOMAINS.some(d => user.email?.toLowerCase().endsWith(d));

    // Ensure profile row exists (trigger may have failed silently)
    await fetch("/api/auth/ensure-profile", { method: "POST" });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = profile?.role;
    const isAdmin = isAdminEmail || role === "admin" || role === "ops" || role === "finance";

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", user.id);

    if (profileError) { setError(profileError.message); setLoading(false); return; }

    if (isAdmin) {
      router.push("/admin");
      return;
    }

    setStep("folder");

    // Create Drive folder for influencers/agencies only
    const folderRes = await fetch("/api/drive/create-folder", { method: "POST" });
    if (!folderRes.ok) {
      console.warn("Drive folder creation failed:", await folderRes.text());
    }

    if (role === "approver") {
      router.push("/approver");
    } else {
      router.push("/influencer");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-im8-burgundy px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-im8-burgundy">Welcome to IM8</h1>
          <p className="text-sm text-im8-burgundy/60 mt-2">
            {step === "folder" ? "Setting up your workspace…" : "Just a few details to get started"}
          </p>
        </div>

        {step === "folder" ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-10 h-10 border-4 border-im8-red/30 border-t-im8-red rounded-full animate-spin mx-auto" />
            <p className="text-sm text-im8-burgundy/60">Creating your Google Drive folder…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Full name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name" required
                className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 text-im8-burgundy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Phone (optional)</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 text-im8-burgundy" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
              {loading ? "Saving…" : "Continue"}
            </button>
          </form>
        )}

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}
