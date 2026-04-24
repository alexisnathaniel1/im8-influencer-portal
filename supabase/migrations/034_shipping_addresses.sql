-- Multiple shipping addresses per creator / deal
-- Run this in Supabase SQL editor.

create table if not exists shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  deal_id    uuid references deals(id)    on delete cascade,
  label          text    not null default 'Home',
  is_primary     boolean not null default false,
  recipient_name text    not null default '',
  phone          text,
  address_line1  text    not null default '',
  address_line2  text,
  city           text    not null default '',
  state          text,
  postal_code    text    not null default '',
  country        text    not null default 'Singapore',
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists shipping_addresses_profile_id_idx on shipping_addresses(profile_id) where profile_id is not null;
create index if not exists shipping_addresses_deal_id_idx    on shipping_addresses(deal_id)    where deal_id    is not null;

alter table shipping_addresses enable row level security;

-- Authenticated partners can manage their own profile-level addresses
create policy "partner_own_addresses" on shipping_addresses
  for all to authenticated
  using  (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Admin / management / support / ops can manage all
create policy "admin_all_addresses" on shipping_addresses
  for all to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'management', 'support', 'ops')
    )
  );

-- Tell PostgREST to reload the schema cache immediately
notify pgrst, 'reload schema';
