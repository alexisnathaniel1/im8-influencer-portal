import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDealFolder } from "@/lib/drive/deal-folders";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await request.json();
  if (!dealId) return NextResponse.json({ error: "dealId required" }, { status: 400 });

  const admin = createAdminClient();
  const result = await ensureDealFolder(admin, dealId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    folderId: result.folderId,
    folderUrl: `https://drive.google.com/drive/folders/${result.folderId}`,
    partnerFolderId: result.partnerFolderId,
    alreadyLinked: result.alreadyLinked,
    created: !result.alreadyLinked,
  });
}
