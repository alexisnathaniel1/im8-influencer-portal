create type deal_status as enum (
  'contacted',
  'negotiating',
  'agreed',
  'pending_approval',
  'approved',
  'rejected',
  'contracted',
  'live',
  'completed',
  'declined'
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  discovery_profile_id uuid references discovery_profiles(id) on delete set null,
  influencer_profile_id uuid references profiles(id) on delete set null,
  status deal_status not null default 'contacted',

  -- Influencer info (denormalized for pre-auth period)
  influencer_name text not null default '',
  influencer_email text not null default '',
  agency_name text,
  platform_primary primary_platform not null default 'instagram',

  -- Deal terms (required before mark-agreed)
  deliverables jsonb default '[]'::jsonb,
  monthly_rate_cents int,
  total_months int default 3,
  total_rate_cents int generated always as (
    coalesce(monthly_rate_cents, 0) * coalesce(total_months, 3)
  ) stored,
  campaign_start date,
  campaign_end date,
  usage_rights_months int default 12,

  -- Approval context
  rationale text,
  outreach_thread_url text,
  rejection_reason text,

  -- Ownership
  assigned_to uuid references profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table deals enable row level security;

create policy "Admin/ops/finance can read deals"
  on deals for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops', 'finance')
    )
  );

create policy "Influencer can read own deals"
  on deals for select
  using (influencer_profile_id = auth.uid());

create policy "Admin/ops can insert/update deals"
  on deals for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create trigger deals_updated_at
  before update on deals
  for each row execute function set_updated_at();

-- Validate required fields before agreed status (enforced in app, this is a belt-and-suspenders check)
create or replace function check_deal_agreed()
returns trigger language plpgsql as $$
begin
  if new.status = 'agreed' and (
    new.deliverables = '[]'::jsonb or
    new.monthly_rate_cents is null or
    new.total_months is null or
    new.rationale is null or
    new.rationale = ''
  ) then
    raise exception 'Deal cannot be marked agreed without deliverables, rate, total months, and rationale';
  end if;
  return new;
end;
$$;

create trigger deals_agreed_validation
  before update on deals
  for each row execute function check_deal_agreed();
