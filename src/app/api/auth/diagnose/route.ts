import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasServiceKey) {
    return NextResponse.json({
      ok: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY is not set on Vercel",
      env: { hasServiceKey, hasSupabaseUrl, hasAnonKey },
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("id, email, role, full_name").limit(100);

  return NextResponse.json({
    ok: !error,
    error: error?.message,
    env: { hasServiceKey, hasSupabaseUrl, hasAnonKey },
    profiles: data,
  });
}
