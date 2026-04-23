create table deliverables (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  catalog_id uuid references deliverable_catalog(id) on delete set null,
  brief_id uuid references briefs(id) on delete set null,

  deliverable_type text not null,   -- 'IGR', 'IGS', 'TIKTOK_VIDEO', 'UGC', ...
  platform text not null default 'instagram',
  title text,
  due_date date,
  live_date date,
  post_url text,

  status text not null default 'pending',
  -- pending | in_progress | submitted | approved | live | completed

  views int,
  likes int,
  comments_count int,
  views_updated_at timestamptz,
  is_story boolean not null default false,

  usage_rights_months int,
  fee_cents int,
  assigned_pic uuid references profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger deliverables_updated_at
  before update on deliverables
  for each row execute function set_updated_at();

alter table deliverables enable row level security;

create policy "Admin/ops can manage deliverables"
  on deliverables for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Influencer can read own deliverables"
  on deliverables for select
  using (
    exists (
      select 1 from deals d
      where d.id = deliverables.deal_id
      and d.influencer_profile_id = auth.uid()
    )
  );

-- Link submissions to a specific deliverable row
alter table submissions
  add column if not exists deliverable_id uuid references deliverables(id) on delete set null;

-- Comments on deliverable rows
create table if not exists deliverable_comments (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_display_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table deliverable_comments enable row level security;

create policy "Admin/ops can manage deliverable comments"
  on deliverable_comments for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );
