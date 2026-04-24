import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();

  // When making this address primary, unset all others in the same scope first
  if (body.is_primary) {
    const { data: existing } = await admin
      .from("shipping_addresses")
      .select("profile_id, deal_id")
      .eq("id", id)
      .single();

    if (existing?.profile_id) {
      await admin.from("shipping_addresses")
        .update({ is_primary: false }).eq("profile_id", existing.profile_id);
    }
    if (existing?.deal_id) {
      await admin.from("shipping_addresses")
        .update({ is_primary: false }).eq("deal_id", existing.deal_id);
    }

    // Keep legacy JSON in sync for profile-level primaries
    if (existing?.profile_id) {
      const allowed = ["recipient_name","phone","address_line1","address_line2","city","state","postal_code","country"];
      const addrFields = Object.fromEntries(
        Object.entries(body).filter(([k]) => allowed.includes(k))
      );
      if (Object.keys(addrFields).length > 0) {
        await admin.from("profiles")
          .update({ shipping_address_json: addrFields })
          .eq("id", existing.profile_id);
      }
    }
  }

  const allowed = [
    "label", "is_primary", "recipient_name", "phone",
    "address_line1", "address_line2", "city", "state", "postal_code", "country",
  ];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const { data: address, error } = await admin
    .from("shipping_addresses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ address });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from("shipping_addresses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
