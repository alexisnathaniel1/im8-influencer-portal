import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import DeliverablesTable from "./deliverables-table";
import { canViewRates } from "@/lib/permissions";

export default async function DeliverablesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string; platform?: string; q?: string; month?: string;
    niche?: string; type?: string;
  }>;
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
      views_updated_at, created_at, sequence, brief_doc_url,
      deal:deal_id(id, influencer_name, platform_primary, niche_tags),
      brief:brief_id(id, title),
      pic:assigned_pic(id, full_name),
      editor:assigned_editor_id(id, full_name)
    `)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("deliverable_type", { ascending: true })
    .order("sequence", { ascending: true, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.platform) query = query.eq("platform", filters.platform);
  if (filters.type) query = query.eq("deliverable_type", filters.type);
  if (filters.month) {
    const [year, month] = filters.month.split("-");
    const start = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    const end = endDate.toISOString().split("T")[0];
    query = query.gte("due_date", start).lte("due_date", end);
  }
  // Influencer / title search: match either the deliverable title or the linked
  // deal's influencer_name. Supabase doesn't support OR across joined tables,
  // so we filter client-side on influencer_name after fetching.
  if (filters.q) {
    query = query.or(`title.ilike.%${filters.q}%`);
  }

  const { data: rawDeliverables } = await query;
  // Flatten Supabase's array-typed foreign key joins to single objects
  let deliverables = (rawDeliverables ?? []).map(d => ({
    ...d,
    deal: (Array.isArray(d.deal) ? d.deal[0] : d.deal) as
      | { id: string; influencer_name: string; platform_primary: string; niche_tags: string[] | null }
      | null,
    brief: Array.isArray(d.brief) ? d.brief[0] ?? null : d.brief,
    pic: Array.isArray(d.pic) ? d.pic[0] ?? null : d.pic,
    editor: Array.isArray(d.editor) ? d.editor[0] ?? null : d.editor,
  }));

  // Client-side post-filter for things Supabase can't easily filter on
  if (filters.q) {
    const q = filters.q.toLowerCase();
    deliverables = deliverables.filter(d =>
      (d.title ?? "").toLowerCase().includes(q) ||
      (d.deal?.influencer_name ?? "").toLowerCase().includes(q)
    );
  }
  if (filters.niche) {
    deliverables = deliverables.filter(d => (d.deal?.niche_tags ?? []).includes(filters.niche!));
  }

  // Fetch the latest approved submission per deliverable so we can show a draft
  // link in the table. One round-trip: select all approved subs matching our ids.
  const deliverableIds = deliverables.map(d => d.id);
  const approvedByDeliverable = new Map<string, { id: string; drive_url: string | null; file_name: string | null }>();
  if (deliverableIds.length > 0) {
    const { data: approvedSubs } = await admin
      .from("submissions")
      .select("id, deliverable_id, drive_url, file_name, status, reviewed_at")
      .in("deliverable_id", deliverableIds)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false });
    for (const s of approvedSubs ?? []) {
      if (s.deliverable_id && !approvedByDeliverable.has(s.deliverable_id)) {
        approvedByDeliverable.set(s.deliverable_id, { id: s.id, drive_url: s.drive_url, file_name: s.file_name });
      }
    }
  }

  // Collect all unique niche tags across fetched deliverables for the filter dropdown
  const nicheSet = new Set<string>();
  const typeSet = new Set<string>();
  for (const d of deliverables) {
    for (const n of d.deal?.niche_tags ?? []) nicheSet.add(n);
    typeSet.add(d.deliverable_type);
  }
  const availableNiches = Array.from(nicheSet).sort();
  const availableTypes = Array.from(typeSet).sort();

  // Annotate each deliverable with its approved-draft link
  const deliverablesWithDraft = deliverables.map(d => ({
    ...d,
    approved_submission: approvedByDeliverable.get(d.id) ?? null,
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
        <p className="text-xs text-im8-burgundy/40 mt-1">
          This tracker mirrors every deliverable set on an approved contract. Edit live dates / view counts here; edit scope on the contract.
        </p>
      </div>
      <DeliverablesTable
        deliverables={deliverablesWithDraft}
        pics={pics ?? []}
        editors={editors ?? []}
        currentFilters={filters}
        availableNiches={availableNiches}
        availableTypes={availableTypes}
        canViewRates={showRates}
      />
    </div>
  );
}
