"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ADMIN_DOMAINS = ["@prenetics.com", "@im8health.com"];

type PartnerType = "creator" | "agency";

export default function SignupPage() {
  const [partnerType, setPartnerType] = useState<PartnerType>("creator");
  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [agencyContactPic, setAgencyContactPic] = useState("");
  const [email, setEmail] = useState("");
  const isAdminEmail = ADMIN_DOMAINS.some(d => email.toLowerCase().endsWith(d));
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

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    const isAdminEmail = ADMIN_DOMAINS.some(d => email.toLowerCase().endsWith(d));
    const accessToken = signUpData.session?.access_token;

    const displayName = isAdminEmail ? fullName : partnerType === "agency" ? agencyName : fullName;

    const res = await fetch("/api/auth/ensure-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        full_name: displayName,
        partner_type: partnerType,
        agency_website: agencyWebsite || null,
        agency_contact_pic: agencyContactPic || null,
      }),
    });

    if (!res.ok) {
      console.warn("ensure-profile failed:", await res.text());
    }

    if (isAdminEmail) {
      window.location.href = "/admin";
    } else {
      window.location.href = "/partner";
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-im8-burgundy px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex justify-center">
            <div className="bg-im8-burgundy rounded-xl p-4">
              <Image src="/logo-white.svg" alt="IM8" width={80} height={40} priority />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-im8-burgundy">Create your account</h1>
            <p className="mt-2 text-sm text-im8-burgundy/60">
              {isAdminEmail ? "IM8 team access" : "Join the IM8 Influencer Portal"}
            </p>
          </div>

          {/* Partner type toggle — hidden for team emails */}
          {!isAdminEmail && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-im8-sand p-1">
              <button
                type="button"
                onClick={() => setPartnerType("creator")}
                className={`py-2 text-sm font-medium rounded-md transition-colors ${
                  partnerType === "creator" ? "bg-white text-im8-burgundy shadow-sm" : "text-im8-burgundy/60 hover:text-im8-burgundy"
                }`}
              >
                I&apos;m a creator
              </button>
              <button
                type="button"
                onClick={() => setPartnerType("agency")}
                className={`py-2 text-sm font-medium rounded-md transition-colors ${
                  partnerType === "agency" ? "bg-white text-im8-burgundy shadow-sm" : "text-im8-burgundy/60 hover:text-im8-burgundy"
                }`}
              >
                I&apos;m an agency
              </button>
            </div>
          )}

          {!isAdminEmail && partnerType === "agency" && (
            <div className="bg-im8-sand/60 border border-im8-stone/30 text-im8-burgundy/80 px-4 py-3 rounded-lg text-xs">
              Tip: you&apos;ll be able to submit multiple creator profiles later from your dashboard.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isAdminEmail ? (
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Full name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name" required
                  className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
              </div>
            ) : partnerType === "creator" ? (
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Full name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name" required
                  className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">Agency / company name</label>
                  <input type="text" value={agencyName} onChange={e => setAgencyName(e.target.value)}
                    placeholder="Acme Talent" required
                    className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">Agency website <span className="text-im8-burgundy/40">(optional)</span></label>
                  <input type="url" value={agencyWebsite} onChange={e => setAgencyWebsite(e.target.value)}
                    placeholder="https://"
                    className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">Primary contact PIC</label>
                  <input type="text" value={agencyContactPic} onChange={e => setAgencyContactPic(e.target.value)}
                    placeholder="Your name" required
                    className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
                </div>
              </>
            )}

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
