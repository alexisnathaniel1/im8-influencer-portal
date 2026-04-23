-- Support role: full nav access but cannot see financial rates
alter type user_role add value if not exists 'support';

-- Cast role to text so we can reference the new enum value in the same transaction
drop policy if exists "Staff can view all profiles" on profiles;
create policy "Staff can view all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role::text in ('admin', 'ops', 'finance', 'approver', 'owner', 'management', 'influencer_team', 'support')
    )
  );
