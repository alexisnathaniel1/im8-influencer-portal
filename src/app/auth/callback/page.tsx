"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function handle() {
      // Parse hash fragment tokens (implicit flow — from magic links / invites)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      const errorCode = params.get("error_code");

      if (errorCode) {
        router.push(`/auth/login?error=${params.get("error_description") ?? "Could not authenticate"}`);
        return;
      }

      // PKCE flow — code in query string
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const queryType = searchParams.get("type");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { router.push("/auth/login?error=Could+not+authenticate"); return; }
        const effectiveType = queryType;
        await redirectAfterAuth(supabase, effectiveType, router);
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) { router.push("/auth/login?error=Could+not+authenticate"); return; }
        await redirectAfterAuth(supabase, type, router);
        return;
      }

      router.push("/auth/login?error=Could+not+authenticate");
    }

    handle();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-im8-burgundy">
      <div className="text-white text-sm">Signing you in…</div>
    </div>
  );
}

async function redirectAfterAuth(
  supabase: ReturnType<typeof createClient>,
  type: string | null,
  router: ReturnType<typeof useRouter>
) {
  if (type === "invite" || type === "magiclink") {
    router.push("/auth/set-password");
    return;
  }

  if (type === "recovery") {
    router.push("/auth/reset-password");
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { router.push("/auth/login"); return; }

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();

  if (!profile?.full_name) { router.push("/auth/onboarding"); return; }
  if (profile.role === "admin" || profile.role === "ops" || profile.role === "finance") { router.push("/admin"); return; }
  if (profile.role === "approver") { router.push("/approver"); return; }
  router.push("/influencer");
}
