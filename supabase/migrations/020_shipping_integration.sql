-- Add shipping address to partner profiles
alter table profiles
  add column if not exists shipping_address_json jsonb default '{}'::jsonb;

-- Gifting requests table — one per shipment per deal
create table if not exists gifting_requests (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  requested_by uuid references profiles(id) on delete set null,

  -- Shipping details (snapshot at time of request, separate from profile)
  recipient_name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text,
  postal_code text not null,
  country text not null default 'Singapore',
  phone text,

  -- Products selected for this shipment
  products jsonb not null default '[]'::jsonb,  -- [{name, sku, qty}]

  -- im8hub integration
  im8hub_request_id text,        -- ID returned by im8hub after submission
  im8hub_status text,            -- 'pending' | 'processing' | 'shipped' | 'delivered'
  tracking_number text,
  tracking_url text,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger gifting_requests_updated_at
  before update on gifting_requests
  for each row execute function set_updated_at();

alter table gifting_requests enable row level security;

create policy "Admin/ops can manage gifting requests"
  on gifting_requests for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Influencer can view own gifting requests"
  on gifting_requests for select
  using (
    exists (
      select 1 from deals d
      where d.id = gifting_requests.deal_id
      and d.influencer_profile_id = auth.uid()
    )
  );
