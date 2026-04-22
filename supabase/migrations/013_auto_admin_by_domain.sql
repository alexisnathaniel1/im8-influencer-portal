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
end;
$$;
