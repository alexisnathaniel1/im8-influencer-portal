"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const dealInviteToken = searchParams.get("deal_invite");
  const prefillEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const supabase = createClient();

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

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

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }

    const accessToken = signInData.session?.access_token;

    // Self-heal: ensure profile row exists with correct role based on email domain
    const ensureRes = await fetch("/api/auth/ensure-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({}),
    });

    let role: string | undefined;
    let fullName: string | undefined;
    if (ensureRes.ok) {
      const data = await ensureRes.json();
      role = data.role;
      fullName = data.full_name;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", signInData.user!.id)
        .single();
      role = profile?.role;
      fullName = profile?.full_name;
    }

    // If logging in via a deal invite, link the account to the deal
    if (dealInviteToken && accessToken) {
      try {
        await fetch("/api/deals/accept-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ token: dealInviteToken }),
        });
      } catch (err) {
        console.warn("accept-invite failed:", err);
      }
    }

    const ADMIN_ROLES = ["admin", "management", "support"];
    if (role === "pending") {
      window.location.href = "/auth/pending";
    } else if (role && ADMIN_ROLES.includes(role)) {
      window.location.href = "/admin";
    } else if (role === "editor") {
      window.location.href = "/editor";
    } else if (!fullName) {
      window.location.href = "/auth/onboarding";
    } else {
      window.location.href = "/partner";
    }
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
              {mode === "login"
                ? dealInviteToken
                  ? "Sign in to accept your invitation"
                  : "Sign in to your account"
                : "Reset your password"}
            </p>
          </div>

          {dealInviteToken && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
              ✓ Sign in to link your account to your collaboration.
            </div>
          )}

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

          <div className="text-center space-y-3">
            {mode === "login" && (
              <>
                <button onClick={() => { setMode("reset"); setError(""); setMessage(""); }}
                  className="text-sm text-im8-burgundy/60 hover:underline block w-full">
                  Forgot your password?
                </button>
                <div className="pt-3 border-t border-im8-stone/20 text-sm text-im8-burgundy/60">
                  Don&apos;t have an account yet?{" "}
                  <Link
                    href={{
                      pathname: "/auth/signup",
                      query: {
                        ...(dealInviteToken ? { deal_invite: dealInviteToken } : {}),
                        ...(email ? { email } : {}),
                      },
                    }}
                    className="text-im8-red font-semibold hover:underline"
                  >
                    Sign up
                  </Link>
                </div>
              </>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
