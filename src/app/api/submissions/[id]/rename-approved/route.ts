import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renameDriveFile } from "@/lib/google/drive";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    // Fetch submission — only admins/management/support should be calling this
    const { data: sub } = await admin
      .from("submissions")
      .select("drive_file_id, file_name, status")
      .eq("id", id)
      .single();

    if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    if (sub.status !== "approved") return NextResponse.json({ error: "Submission is not approved" }, { status: 400 });
    if (!sub.drive_file_id) return NextResponse.json({ ok: true, renamed: false, reason: "no_file_id" });

    // Strip the DRAFT_N suffix (new naming) or trailing timestamp (old naming),
    // then append _APPROVED
    const baseName = (sub.file_name || "content")
      .replace(/_DRAFT_\d+$/, "")   // new: …_DRAFT_2  → strip it
      .replace(/_\d{10,}$/, "");    // old: …_1777966996646 → strip it

    const newName = `${baseName}_APPROVED`;
    const result = await renameDriveFile(sub.drive_file_id, newName);

    // Persist the updated file_name so the portal reflects the new name
    if (result.renamed) {
      await admin
        .from("submissions")
        .update({ file_name: newName })
        .eq("id", id);
    }

    return NextResponse.json({ ok: true, ...result, newName });
  } catch (err) {
    console.error("[rename-approved]", err);
    // Non-fatal — return ok so the approval itself isn't blocked
    return NextResponse.json({ ok: true, renamed: false, reason: String(err) });
  }
}
