import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import DeliverablesTable from "./deliverables-table";
import { canViewRates } from "@/lib/permissions";

// Always fetch fresh data — status and content columns must reflect review-queue actions
export const dynamic = "force-dynamic";

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
      edited_video_url, qa_status, qa_comments,
      scheduled_for_ads, ad_usage_rights_status, whitelisting_granted,
      whitelisted_start_date, whitelisted_end_date,
      deal:deal_id(id, influencer_name, platform_primary, niche_tags, deliverables),
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
  if (filters.q) {
    query = query.or(`title.ilike.%${filters.q}%`);
  }

  const { data: rawDeliverables } = await query;
  let deliverables = (rawDeliverables ?? []).map(d => ({
    ...d,
    deal: (Array.isArray(d.deal) ? d.deal[0] : d.deal) as
      | { id: string; influencer_name: string; platform_primary: string; niche_tags: string[] | null; deliverables: Array<{ code: string; count: number }> | null }
      | null,
    brief: Array.isArray(d.brief) ? d.brief[0] ?? null : d.brief,
    pic: Array.isArray(d.pic) ? d.pic[0] ?? null : d.pic,
    editor: Array.isArray(d.editor) ? d.editor[0] ?? null : d.editor,
  }));

  // Client-side post-filters
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

  // Fetch approved and pending submissions per deliverable in one pass each
  const deliverableIds = deliverables.map(d => d.id);
  const approvedByDeliverable = new Map<string, { id: string; drive_url: string | null; file_name: string | null }>();
  const pendingByDeliverable = new Map<string, { id: string; drive_url: string | null; file_name: string | null }>();

  if (deliverableIds.length > 0) {
    const [{ data: approvedSubs }, { data: pendingSubs }] = await Promise.all([
      admin
        .from("submissions")
        .select("id, deliverable_id, drive_url, file_name, status, reviewed_at")
        .in("deliverable_id", deliverableIds)
        .eq("status", "approved")
        .order("reviewed_at", { ascending: false }),
      admin
        .from("submissions")
        .select("id, deliverable_id, drive_url, file_name, status, submitted_at")
        .in("deliverable_id", deliverableIds)
        .eq("status", "pending")
        .order("submitted_at", { ascending: false }),
    ]);

    for (const s of approvedSubs ?? []) {
      if (s.deliverable_id && !approvedByDeliverable.has(s.deliverable_id)) {
        approvedByDeliverable.set(s.deliverable_id, { id: s.id, drive_url: s.drive_url, file_name: s.file_name });
      }
    }
    for (const s of pendingSubs ?? []) {
      if (s.deliverable_id && !pendingByDeliverable.has(s.deliverable_id)) {
        pendingByDeliverable.set(s.deliverable_id, { id: s.id, drive_url: s.drive_url, file_name: s.file_name });
      }
    }
  }

  // Collect niches and types for filter dropdowns
  const nicheSet = new Set<string>();
  const typeSet = new Set<string>();
  for (const d of deliverables) {
    for (const n of d.deal?.niche_tags ?? []) nicheSet.add(n);
    typeSet.add(d.deliverable_type);
  }
  const availableNiches = Array.from(nicheSet).sort();
  const availableTypes = Array.from(typeSet).sort();

  // Annotate each deliverable with its draft links
  const deliverablesWithDraft = deliverables.map(d => ({
    ...d,
    approved_submission: approvedByDeliverable.get(d.id) ?? null,
    pending_submission: pendingByDeliverable.get(d.id) ?? null,
  }));

  const [{ data: pics }, { data: editors }] = await Promise.all([
    admin.from("profiles").select("id, full_name").eq("role", "admin"),
    admin.from("profiles").select("id, full_name").eq("role", "editor"),
  ]);

  // Count pending items for the page header
  const pendingReviewCount = deliverablesWithDraft.filter(d => d.pending_submission).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-im8-burgundy">Deliverables</h1>
          <p className="text-im8-burgundy/60 mt-1">
            Track every content piece across all active partnerships.
          </p>
          <p className="text-xs text-im8-burgundy/40 mt-1">
            Mirrors every deliverable on approved contracts. Edit live dates / view counts here; edit scope on the contract.
          </p>
        </div>
        {pendingReviewCount > 0 && (
          <Link
            href="/admin/review"
            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium px-4 py-2 rounded-full hover:bg-amber-100 transition-colors"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {pendingReviewCount} pending review
          </Link>
        )}
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
