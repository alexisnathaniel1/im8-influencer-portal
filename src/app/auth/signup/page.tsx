"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }

    router.push("/auth/onboarding");
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
            <h1 className="text-2xl font-bold text-im8-burgundy">Create your account</h1>
            <p className="mt-2 text-sm text-im8-burgundy/60">Join the IM8 Influencer Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters" required minLength={6}
                className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password" required minLength={6}
                className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 px-4 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="text-center">
            <Link href="/auth/login" className="text-sm text-im8-burgundy/60 hover:underline">
              Already have an account? Sign in
            </Link>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
