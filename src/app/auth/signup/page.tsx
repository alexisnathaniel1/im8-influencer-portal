"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ADMIN_DOMAINS = ["@prenetics.com", "@im8health.com"];

type PartnerType = "creator" | "agency";

function SignupForm() {
  const searchParams = useSearchParams();
  const dealInviteToken = searchParams.get("deal_invite");
  const inviteEmail = searchParams.get("email") ?? "";
  const inviteName = searchParams.get("name") ?? "";
  const isInvited = !!dealInviteToken;

  const [partnerType, setPartnerType] = useState<PartnerType>("creator");
  const [fullName, setFullName] = useState(inviteName);
  const [agencyName, setAgencyName] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [agencyContactPic, setAgencyContactPic] = useState("");
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  // If invite token changes email, keep in sync
  useEffect(() => {
    if (inviteEmail) setEmail(inviteEmail);
    if (inviteName) setFullName(inviteName);
  }, [inviteEmail, inviteName]);

  const isAdminEmail = ADMIN_DOMAINS.some(d => email.toLowerCase().endsWith(d));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

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
        partner_type: isAdminEmail ? null : partnerType,
        agency_website: agencyWebsite || null,
        agency_contact_pic: agencyContactPic || null,
      }),
    });

    let role: string | undefined;
    if (res.ok) {
      const data = await res.json();
      role = data.role;
    } else {
      console.warn("ensure-profile failed:", await res.text());
    }

    // If signed up via a deal invite, link the account to the deal
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
        // Non-fatal — user can still access the portal
      }
    }

    const ADMIN_ROLES = ["admin", "management", "support"];
    if (role === "pending") {
      window.location.href = "/auth/pending";
    } else if (role && ADMIN_ROLES.includes(role)) {
      window.location.href = "/admin";
    } else if (role === "editor") {
      window.location.href = "/editor";
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
            <h1 className="text-2xl font-bold text-im8-burgundy">
              {isInvited ? "Accept your invitation" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm text-im8-burgundy/60">
              {isInvited
                ? "You've been invited to the IM8 Partner Portal. Create a password to get started."
                : isAdminEmail
                  ? "IM8 team access"
                  : "Join the IM8 Influencer Portal"}
            </p>
          </div>

          {isInvited && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
              ✓ Your collaboration details will be automatically connected once you sign up.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email — locked when invited */}
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Email address</label>
              {isInvited ? (
                <input
                  type="email" value={email} disabled
                  className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 text-im8-burgundy/60 bg-im8-sand/40 cursor-not-allowed text-sm"
                />
              ) : (
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoFocus
                  className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors"
                />
              )}
            </div>

            {/* Partner type toggle — only for non-admin, non-invited external partners */}
            {!isAdminEmail && !isInvited && email && (
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-im8-sand p-1">
                <button type="button" onClick={() => setPartnerType("creator")}
                  className={`py-2 text-sm font-medium rounded-md transition-colors ${
                    partnerType === "creator" ? "bg-white text-im8-burgundy shadow-sm" : "text-im8-burgundy/60 hover:text-im8-burgundy"
                  }`}>
                  I&apos;m a creator
                </button>
                <button type="button" onClick={() => setPartnerType("agency")}
                  className={`py-2 text-sm font-medium rounded-md transition-colors ${
                    partnerType === "agency" ? "bg-white text-im8-burgundy shadow-sm" : "text-im8-burgundy/60 hover:text-im8-burgundy"
                  }`}>
                  I&apos;m an agency
                </button>
              </div>
            )}

            {!isAdminEmail && !isInvited && partnerType === "agency" && email && (
              <div className="bg-im8-sand/60 border border-im8-stone/30 text-im8-burgundy/80 px-4 py-3 rounded-lg text-xs">
                Tip: you&apos;ll be able to submit multiple creator profiles later from your dashboard.
              </div>
            )}

            {/* Name fields */}
            {isAdminEmail ? (
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Full name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name" required
                  className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
              </div>
            ) : isInvited ? (
              <div>
                <label className="block text-sm font-medium text-im8-burgundy mb-1">Your name</label>
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
                  <label className="block text-sm font-medium text-im8-burgundy mb-1">Primary contact name</label>
                  <input type="text" value={agencyContactPic} onChange={e => setAgencyContactPic(e.target.value)}
                    placeholder="Your name" required
                    className="w-full px-4 py-3 rounded-lg border border-im8-stone/40 focus:outline-none focus:ring-2 focus:ring-im8-red/50 focus:border-im8-red text-im8-burgundy transition-colors" />
                </div>
              </>
            )}

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

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 px-4 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
              {loading ? "Creating account..." : isInvited ? "Accept invite & get started" : "Create Account"}
            </button>
          </form>

          <div className="text-center">
            <Link href={isInvited ? `/auth/login?deal_invite=${dealInviteToken}&email=${encodeURIComponent(email)}` : "/auth/login"}
              className="text-sm text-im8-burgundy/60 hover:underline">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
