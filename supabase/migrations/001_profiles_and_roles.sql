-- Roles: admin, ops, finance, approver, influencer
create type user_role as enum ('admin', 'ops', 'finance', 'approver', 'influencer');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'influencer',
  full_name text not null default '',
  email text not null default '',
  phone text,
  agency_name text,
  instagram_handle text,
  tiktok_handle text,
  youtube_handle text,
  shopify_discount_code text,
  drive_folder_url text,
  shipping_address jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Admin/ops/finance/approver can view all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops', 'finance', 'approver')
    )
  );

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Admin/ops can update any profile"
  on profiles for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Admin/ops can insert profiles"
  on profiles for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'influencer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();
