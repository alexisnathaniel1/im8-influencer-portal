-- Replace overly-restrictive INSERT policy so signup trigger and ensure-profile can write rows
drop policy if exists "Admin/ops can insert profiles" on profiles;

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Service role can insert any profile"
  on profiles for insert
  to service_role
  with check (true);

-- Trigger assigns admin role by email domain; exception handler guarantees signup never blocks
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when new.email ilike '%@prenetics.com' or new.email ilike '%@im8health.com'
        then 'admin'::user_role
      else 'influencer'::user_role
    end
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

-- Backfill existing profiles with wrong role
update profiles
set role = 'admin'
where (email ilike '%@prenetics.com' or email ilike '%@im8health.com')
  and role <> 'admin';
