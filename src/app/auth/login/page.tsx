"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) setError(error.message);
      else setMessage("Check your email for a password reset link.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      const role = profile?.role;
      if (role === "admin" || role === "ops" || role === "finance") {
        window.location.href = "/admin";
      } else if (role === "approver") {
        window.location.href = "/approver";
      } else if (!profile?.full_name) {
        window.location.href = "/auth/onboarding";
      } else {
        window.location.href = "/influencer";
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-im8-burgundy px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-8">
          <div className="flex justify-center">
            <div className="bg-im8-burgundy rounded-xl p-4">
              <Image src="/logo-white.svg" alt="IM8" width={80} height={40} priority />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-im8-burgundy">IM8 Influencer Portal</h1>
            <p className="mt-2 text-sm text-im8-burgundy/60">
              {mode === "login" ? "Sign in to your account" : "Reset your password"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Email address</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors"
              />
            </div>
            {mode === "login" && (
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Password</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password" required minLength={6}
                  className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors"
                />
              </div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full py-3 px-4 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors"
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Send Reset Link"}
            </button>
          </form>

          <div className="text-center space-y-2">
            {mode === "login" && (
              <button onClick={() => { setMode("reset"); setError(""); setMessage(""); }}
                className="text-sm text-im8-burgundy/60 hover:underline block w-full">
                Forgot your password?
              </button>
            )}
            {mode === "reset" && (
              <button onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                className="text-sm text-im8-red hover:underline">
                Back to sign in
              </button>
            )}
          </div>

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm text-center">{message}</div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
