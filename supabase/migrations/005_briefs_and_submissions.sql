create type brief_status as enum ('draft', 'sent', 'accepted', 'revision_requested');
create type submission_status as enum ('pending', 'approved', 'rejected', 'revision_requested');
create type content_type as enum ('draft', 'final', 'raw_footage');

create table briefs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  title text not null default 'Content Brief',
  body_markdown text not null default '',
  platform text,
  deliverable_type text,
  due_date date,
  status brief_status not null default 'draft',
  sent_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  brief_id uuid references briefs(id) on delete set null,
  influencer_id uuid references profiles(id) on delete set null,

  -- File info
  drive_file_id text,
  drive_url text,
  file_name text,
  file_hash text,
  content_type content_type not null default 'draft',
  platform text,
  post_url text,

  -- Review
  status submission_status not null default 'pending',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  feedback text,

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table submission_ratings (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  rated_by uuid references profiles(id) on delete set null,
  framework_score int check (framework_score between 1 and 5),
  authenticity_score int check (authenticity_score between 1 and 5),
  algorithm_score int check (algorithm_score between 1 and 5),
  feedback text,
  general_notes text,
  created_at timestamptz not null default now()
);

-- RLS for briefs
alter table briefs enable row level security;

create policy "Admin/ops can manage briefs"
  on briefs for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Influencer can view sent briefs for own deals"
  on briefs for select
  using (
    status != 'draft'
    and exists (
      select 1 from deals d
      where d.id = deal_id
      and d.influencer_profile_id = auth.uid()
    )
  );

-- RLS for submissions
alter table submissions enable row level security;

create policy "Admin/ops can view all submissions"
  on submissions for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Admin/ops can update submissions"
  on submissions for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Influencer can view/insert own submissions"
  on submissions for all
  using (influencer_id = auth.uid());

-- RLS for ratings
alter table submission_ratings enable row level security;

create policy "Admin/ops can manage ratings"
  on submission_ratings for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create trigger briefs_updated_at
  before update on briefs
  for each row execute function set_updated_at();

create trigger submissions_updated_at
  before update on submissions
  for each row execute function set_updated_at();
