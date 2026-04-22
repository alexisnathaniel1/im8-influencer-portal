import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInfluencerFolder } from "@/lib/google/drive";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, drive_folder_url")
    .eq("id", user.id)
    .single();

  if (!profile?.full_name) return NextResponse.json({ error: "Profile not complete" }, { status: 400 });
  if (profile.drive_folder_url) return NextResponse.json({ folderUrl: profile.drive_folder_url });

  const folderName = `IM8_${profile.full_name.toUpperCase().replace(/\s+/g, "_")}`;
  const folderUrl = await createInfluencerFolder(folderName, profile.email ?? user.email ?? "");

  const admin = createAdminClient();
  await admin.from("profiles").update({ drive_folder_url: folderUrl }).eq("id", user.id);

  return NextResponse.json({ folderUrl });
}
