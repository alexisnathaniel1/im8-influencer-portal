-- Phase 1: deliverable catalog (admin-managed list of deliverable types with default rates)
-- + extensions to discovery_profiles for positioning, proposed deliverables, and
-- the "Others" free-text niche specifier.
--
-- Also reconciles a few column mismatches between prior migrations and the intake
-- API (niche_tags, portfolio_url, ai_scored_at, source='inbound_form').

-- ── Deliverable catalog ─────────────────────────────────────────────────────
create table if not exists deliverable_catalog (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  platform primary_platform not null default 'instagram',
  default_rate_cents int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table deliverable_catalog enable row level security;

drop policy if exists "Anyone can read active deliverables" on deliverable_catalog;
create policy "Anyone can read active deliverables"
  on deliverable_catalog for select
  using (is_active = true or auth.role() = 'service_role');

drop policy if exists "Admin/ops can manage deliverables" on deliverable_catalog;
create policy "Admin/ops can manage deliverables"
  on deliverable_catalog for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('admin', 'ops')
    )
  );

-- Seed common deliverable types if the table is empty.
insert into deliverable_catalog (code, label, platform, default_rate_cents, sort_order)
select * from (values
  ('IGR', 'Instagram Reel', 'instagram'::primary_platform, 150000, 10),
  ('IGS', 'Instagram Story', 'instagram'::primary_platform, 50000, 20),
  ('IGP', 'Instagram Post', 'instagram'::primary_platform, 100000, 30),
  ('TT_VIDEO', 'TikTok Video', 'tiktok'::primary_platform, 150000, 40),
  ('YT_LONG', 'YouTube Long-form', 'youtube'::primary_platform, 500000, 50),
  ('YT_SHORT', 'YouTube Short', 'youtube'::primary_platform, 150000, 60),
  ('WHITELIST', 'Whitelisting Rights', 'other'::primary_platform, 100000, 70),
  ('UGC', 'UGC Video (raw)', 'other'::primary_platform, 80000, 80)
) as v(code, label, platform, default_rate_cents, sort_order)
where not exists (select 1 from deliverable_catalog);

-- ── Discovery profiles extensions ──────────────────────────────────────────
alter table discovery_profiles
  add column if not exists positioning text,
  add column if not exists proposed_deliverables jsonb default '[]'::jsonb,
  add column if not exists others_niche text,
  add column if not exists niche_tags text[] default '{}',
  add column if not exists portfolio_url text,
  add column if not exists ai_scored_at timestamptz,
  add column if not exists agency_name text,
  add column if not exists submitted_by_profile_id uuid references profiles(id) on delete set null;

-- Keep agency_name and submitter_agency in sync for legacy rows
-- (only run if the legacy submitter_agency column exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discovery_profiles'
      and column_name = 'submitter_agency'
  ) then
    execute $sql$
      update discovery_profiles set agency_name = submitter_agency
        where agency_name is null and submitter_agency is not null
    $sql$;
  end if;
end $$;

-- Backfill niche_tags from legacy "niche" column where missing
-- (only run if the legacy niche column exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discovery_profiles'
      and column_name = 'niche'
  ) then
    execute $sql$
      update discovery_profiles
        set niche_tags = niche
        where (niche_tags is null or niche_tags = '{}')
          and niche is not null and niche != '{}'
    $sql$;
  end if;
end $$;

-- Allow the intake API's existing 'inbound_form' source value.
alter type discovery_source add value if not exists 'inbound_form';

-- Partner (agency/creator) read-own submissions policy.
drop policy if exists "Partner can read own submissions" on discovery_profiles;
create policy "Partner can read own submissions"
  on discovery_profiles for select
  using (
    submitted_by_profile_id = auth.uid()
    or (
      auth.uid() is not null
      and exists (
        select 1 from profiles p
        where p.id = auth.uid()
        and lower(p.email) = lower(discovery_profiles.submitter_email)
      )
    )
  );
