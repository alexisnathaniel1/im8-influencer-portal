import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// im8hub API endpoint — fill in once Marco provides the details
const IM8HUB_API_URL = process.env.IM8HUB_API_URL ?? "";
const IM8HUB_API_KEY = process.env.IM8HUB_API_KEY ?? "";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("gifting_requests")
    .select("*")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { recipient_name, phone, address_line1, address_line2, city, state, postal_code, country, products, notes } = body;

  if (!recipient_name || !address_line1 || !city || !postal_code || !country) {
    return NextResponse.json({ error: "Missing required address fields" }, { status: 400 });
  }
  if (!Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ error: "Select at least one product" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Insert the request into our DB first
  const { data: giftingRow, error: insertError } = await admin
    .from("gifting_requests")
    .insert({
      deal_id: id,
      requested_by: user.id,
      recipient_name,
      address_line1,
      address_line2: address_line2 || null,
      city,
      state: state || null,
      postal_code,
      country,
      phone: phone || null,
      products,
      notes: notes || null,
      im8hub_status: "pending",
    })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Push to im8hub if credentials are configured
  if (IM8HUB_API_URL && IM8HUB_API_KEY) {
    try {
      // Payload shape — confirm with Marco / im8hub API docs
      const im8hubPayload = {
        reference_id: giftingRow!.id,
        recipient: { name: recipient_name, phone },
        address: { line1: address_line1, line2: address_line2, city, state, postal_code, country },
        items: products,
        notes,
      };

      const hubRes = await fetch(IM8HUB_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${IM8HUB_API_KEY}`,
        },
        body: JSON.stringify(im8hubPayload),
      });

      if (hubRes.ok) {
        const hubData = await hubRes.json();
        await admin
          .from("gifting_requests")
          .update({
            im8hub_request_id: hubData.id ?? hubData.request_id ?? null,
            im8hub_status: hubData.status ?? "submitted",
          })
          .eq("id", giftingRow!.id);
      } else {
        console.error("[gifting-request] im8hub returned", hubRes.status, await hubRes.text());
      }
    } catch (err) {
      // Non-fatal — request is saved in our DB, can be retried or manually forwarded
      console.error("[gifting-request] im8hub push failed:", err);
    }
  }

  return NextResponse.json({ success: true, id: giftingRow!.id });
}
