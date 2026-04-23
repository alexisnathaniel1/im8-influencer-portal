import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import IntakeForm from "./intake-form";

export default async function IntakePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signup?redirect=/intake");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, partner_type, agency_contact_pic, role")
    .eq("id", user.id)
    .single();

  const { data: deliverables } = await admin
    .from("deliverable_catalog")
    .select("id, code, label, platform, default_rate_cents")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const submitterName = profile?.partner_type === "agency"
    ? (profile?.agency_contact_pic || profile?.full_name || "")
    : (profile?.full_name || "");
  const submitterAgency = profile?.partner_type === "agency" ? (profile?.full_name || "") : "";

  return (
    <IntakeForm
      submitterName={submitterName}
      submitterEmail={profile?.email || user.email || ""}
      submitterAgency={submitterAgency}
      partnerType={profile?.partner_type === "agency" ? "agency" : "creator"}
      deliverables={deliverables ?? []}
    />
  );
}
