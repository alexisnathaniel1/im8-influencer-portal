import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map(c => ({
    name: c.name,
    valuePrefix: c.value.slice(0, 40),
    length: c.value.length,
  }));

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

  return NextResponse.json({
    cookies: allCookies,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    getUser: {
      userId: userData?.user?.id ?? null,
      email: userData?.user?.email ?? null,
      error: userErr?.message ?? null,
    },
    getSession: {
      hasSession: !!sessionData?.session,
      error: sessionErr?.message ?? null,
    },
  });
}
