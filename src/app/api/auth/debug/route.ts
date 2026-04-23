import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map(c => ({ name: c.name, length: c.value.length }));

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();

  // Replicate what admin layout does — read profile with the USER's client (RLS-bound)
  let userScopedProfile = null;
  let userScopedProfileErr = null;
  if (userData?.user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", userData.user.id)
      .single();
    userScopedProfile = data;
    userScopedProfileErr = error?.message ?? null;
  }

  // Also read with admin client (bypasses RLS) for comparison
  let adminProfile = null;
  if (userData?.user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", userData.user.id)
      .single();
    adminProfile = data;
  }

  return NextResponse.json({
    cookies: allCookies,
    getUser: {
      userId: userData?.user?.id ?? null,
      email: userData?.user?.email ?? null,
      error: userErr?.message ?? null,
    },
    userScopedProfile,
    userScopedProfileErr,
    adminProfile,
  });
}
