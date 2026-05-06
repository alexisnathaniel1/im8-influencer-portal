import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewRates } from "@/lib/permissions";
import BulkUploadClient from "./bulk-upload-client";

export default async function BulkUploadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const showRates = canViewRates((profile as { role?: string } | null)?.role ?? "");

  return <BulkUploadClient canViewRates={showRates} />;
}
