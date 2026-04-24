import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dealId = searchParams.get("dealId");
  const forSelf = searchParams.get("forSelf");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // ── Creator fetching their own addresses ──────────────────────────────────
  if (forSelf) {
    const { data: rows } = await admin
      .from("shipping_addresses")
      .select("*")
      .eq("profile_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at");

    // Fall back to legacy JSON if no rows yet
    if (!rows || rows.length === 0) {
      const { data: profile } = await admin
        .from("profiles").select("shipping_address_json").eq("id", user.id).single();
      const legacy = profile?.shipping_address_json as Record<string, unknown> | null;
      if (legacy?.address_line1) {
        return NextResponse.json({
          addresses: [{ id: "legacy", is_primary: true, is_legacy: true, label: "Saved", ...legacy }],
        });
      }
    }
    return NextResponse.json({ addresses: rows ?? [] });
  }

  // ── Admin fetching addresses for a deal ───────────────────────────────────
  if (dealId) {
    const { data: deal } = await admin
      .from("deals").select("influencer_profile_id").eq("id", dealId).single();

    const profileId: string | null =
      deal?.influencer_profile_id && typeof deal.influencer_profile_id === "object"
        ? (deal.influencer_profile_id as { id: string }).id ?? null
        : (deal?.influencer_profile_id as string | null) ?? null;

    let query = admin.from("shipping_addresses").select("*");
    if (profileId) {
      query = query.or(`deal_id.eq.${dealId},profile_id.eq.${profileId}`);
    } else {
      query = query.eq("deal_id", dealId);
    }
    const { data: rows } = await query
      .order("is_primary", { ascending: false })
      .order("created_at");

    // Fall back to legacy JSON if no rows yet
    if ((!rows || rows.length === 0) && profileId) {
      const { data: profile } = await admin
        .from("profiles").select("shipping_address_json").eq("id", profileId).single();
      const legacy = profile?.shipping_address_json as Record<string, unknown> | null;
      if (legacy?.address_line1) {
        return NextResponse.json({
          addresses: [{ id: "legacy", is_primary: true, is_legacy: true, label: "From creator portal", ...legacy }],
        });
      }
    }
    return NextResponse.json({ addresses: rows ?? [] });
  }

  return NextResponse.json({ addresses: [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();

  // Unset other primaries in the same scope before inserting
  if (body.is_primary) {
    if (body.profile_id) {
      await admin.from("shipping_addresses")
        .update({ is_primary: false }).eq("profile_id", body.profile_id);
    }
    if (body.deal_id) {
      await admin.from("shipping_addresses")
        .update({ is_primary: false }).eq("deal_id", body.deal_id);
    }
  }

  const { data: address, error } = await admin
    .from("shipping_addresses")
    .insert({
      profile_id:     body.profile_id    || null,
      deal_id:        body.deal_id       || null,
      label:          body.label         || "Home",
      is_primary:     !!body.is_primary,
      recipient_name: body.recipient_name || "",
      phone:          body.phone         || null,
      address_line1:  body.address_line1 || "",
      address_line2:  body.address_line2 || null,
      city:           body.city          || "",
      state:          body.state         || null,
      postal_code:    body.postal_code   || "",
      country:        body.country       || "Singapore",
      created_by:     user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Keep legacy JSON in sync when creator sets a profile-level primary
  if (body.profile_id && body.is_primary) {
    await admin.from("profiles").update({
      shipping_address_json: {
        recipient_name: body.recipient_name,
        phone:          body.phone,
        address_line1:  body.address_line1,
        address_line2:  body.address_line2,
        city:           body.city,
        state:          body.state,
        postal_code:    body.postal_code,
        country:        body.country,
      },
    }).eq("id", body.profile_id);
  }

  return NextResponse.json({ address });
}
