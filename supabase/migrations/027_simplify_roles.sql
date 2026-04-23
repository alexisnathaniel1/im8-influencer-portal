-- Simplify roles: consolidate owner/ops/finance/influencer_team into admin,
-- and retire approver (replaced by the public /review email-link flow).
--
-- We can't drop enum values in Postgres without rewriting the column, so the
-- enum keeps the old values but the app no longer uses them. Existing users
-- on those roles get remapped here so they don't end up stuck.

update profiles
set role = 'admin'
where role::text in ('owner', 'ops', 'finance', 'influencer_team');

-- Approver accounts (Josh/Noa/Rahul) are no longer used — remap to admin so
-- they still have access if they log in, and can be demoted in settings.
update profiles
set role = 'admin'
where role::text = 'approver';
