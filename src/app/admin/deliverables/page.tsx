import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import DeliverablesTable from "./deliverables-table";
import { canViewRates } from "@/lib/permissions";

export default async function DeliverablesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; platform?: string; q?: string; month?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const showRates = canViewRates(profile?.role ?? "");

  const filters = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("deliverables")
    .select(`
      id, deliverable_type, platform, title, status, due_date, live_date,
      post_url, views, likes, comments_count, is_story, fee_cents,
      views_updated_at, created_at,
      deal:deal_id(id, influencer_name, platform_primary),
      brief:brief_id(id, title),
      pic:assigned_pic(id, full_name),
      editor:assigned_editor_id(id, full_name)
    `)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.platform) query = query.eq("platform", filters.platform);
  if (filters.month) {
    const [year, month] = filters.month.split("-");
    const start = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    const end = endDate.toISOString().split("T")[0];
    query = query.gte("due_date", start).lte("due_date", end);
  }
  if (filters.q) {
    query = query.ilike("title", `%${filters.q}%`);
  }

  const { data: rawDeliverables } = await query;
  // Flatten Supabase's array-typed foreign key joins to single objects
  const deliverables = (rawDeliverables ?? []).map(d => ({
    ...d,
    deal: Array.isArray(d.deal) ? d.deal[0] ?? null : d.deal,
    brief: Array.isArray(d.brief) ? d.brief[0] ?? null : d.brief,
    pic: Array.isArray(d.pic) ? d.pic[0] ?? null : d.pic,
    editor: Array.isArray(d.editor) ? d.editor[0] ?? null : d.editor,
  }));

  const [{ data: pics }, { data: editors }] = await Promise.all([
    admin.from("profiles").select("id, full_name").eq("role", "admin"),
    admin.from("profiles").select("id, full_name").eq("role", "editor"),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-im8-burgundy">Deliverables</h1>
        <p className="text-im8-burgundy/60 mt-1">Track every content piece across all active partnerships.</p>
      </div>
      <DeliverablesTable
        deliverables={deliverables ?? []}
        pics={pics ?? []}
        editors={editors ?? []}
        currentFilters={filters}
        canViewRates={showRates}
      />
    </div>
  );
}
