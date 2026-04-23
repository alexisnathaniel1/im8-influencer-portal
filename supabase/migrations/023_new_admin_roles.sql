-- Add new admin roles for fine-grained access control
alter type user_role add value if not exists 'owner';
alter type user_role add value if not exists 'management';
alter type user_role add value if not exists 'influencer_team';

-- Cast role to text so we can reference the new enum values in the same transaction
drop policy if exists "Admin/ops/finance/approver can view all profiles" on profiles;
create policy "Staff can view all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role::text in ('admin', 'ops', 'finance', 'approver', 'owner', 'management', 'influencer_team')
    )
  );

drop policy if exists "Admin/ops can update any profile" on profiles;
create policy "Admin/ops/owner can update any profile"
  on profiles for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role::text in ('admin', 'ops', 'owner')
    )
  );
