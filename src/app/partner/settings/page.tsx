import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ShippingAddressForm from "./shipping-address-form";

export default async function PartnerSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">Settings</h1>
        <p className="text-im8-burgundy/60 mt-1">Manage your shipping addresses for product deliveries.</p>
      </div>

      <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-im8-burgundy">Shipping addresses</h2>
          <p className="text-sm text-im8-burgundy/50 mt-0.5">
            Your primary address is used when IM8 sends you products. You can save multiple and switch the primary at any time.
          </p>
        </div>
        <ShippingAddressForm profileId={user.id} defaultName={profile?.full_name ?? ""} />
      </div>
    </div>
  );
}
