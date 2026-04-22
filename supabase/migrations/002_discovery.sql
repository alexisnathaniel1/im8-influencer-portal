create type discovery_status as enum ('new', 'reviewing', 'shortlisted', 'rejected', 'converted');
create type discovery_source as enum ('intake_form', 'agency_email', 'manual');
create type primary_platform as enum ('instagram', 'tiktok', 'youtube', 'multi', 'other');

create table discovery_profiles (
  id uuid primary key default gen_random_uuid(),
  status discovery_status not null default 'new',
  source discovery_source not null default 'intake_form',

  -- Submitter (agency or self)
  submitter_email text not null default '',
  submitter_name text not null default '',
  submitter_agency text,

  -- Influencer info
  influencer_name text not null default '',
  instagram_handle text,
  tiktok_handle text,
  youtube_handle text,
  platform_primary primary_platform not null default 'instagram',
  follower_count int,
  engagement_rate numeric(5,2),
  niche text[] default '{}',
  proposed_rate_cents int,
  portfolio_links text[] default '{}',
  pitch_attachment_url text,
  notes text,

  -- AI scoring
  ai_score int check (ai_score between 0 and 100),
  ai_summary text,
  ai_red_flags text[] default '{}',
  ai_niche_tags text[] default '{}',

  -- Assignment
  assigned_to uuid references profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table discovery_profiles enable row level security;

create policy "Admin/ops can read all discovery profiles"
  on discovery_profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Admin/ops can insert/update discovery profiles"
  on discovery_profiles for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create trigger discovery_profiles_updated_at
  before update on discovery_profiles
  for each row execute function set_updated_at();
