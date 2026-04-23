import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealId = request.nextUrl.searchParams.get("dealId");
  if (!dealId) return NextResponse.json({ error: "dealId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("edited_videos")
    .select("id, deal_id, canonical_file_name, original_file_name, drive_url, admin_status, influencer_status, created_at, uploaded_by(full_name)")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  const videos = (data ?? []).map(v => {
    const uploader = Array.isArray(v.uploaded_by) ? v.uploaded_by[0] : v.uploaded_by;
    return {
      ...v,
      uploaded_by_name: (uploader as { full_name: string } | null)?.full_name ?? "Editor",
      uploaded_by: undefined,
    };
  });

  return NextResponse.json({ videos });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId, deliverableId, driveFileId, driveUrl, originalFileName, canonicalFileName } = await request.json();
  if (!dealId || !driveFileId || !driveUrl || !originalFileName || !canonicalFileName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("edited_videos").insert({
    deal_id: dealId,
    deliverable_id: deliverableId ?? null,
    uploaded_by: user.id,
    drive_file_id: driveFileId,
    drive_url: driveUrl,
    original_file_name: originalFileName,
    canonical_file_name: canonicalFileName,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
