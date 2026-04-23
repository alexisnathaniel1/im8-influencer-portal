-- Fix RLS infinite recursion: staff-view policy queried profiles from within a
-- policy on profiles, which triggered the same policy recursively.
-- Admin-level queries that need to see all profiles already use the service-role
-- client (which bypasses RLS), so we only need the self-view policy here.
drop policy if exists "Staff can view all profiles" on profiles;
drop policy if exists "Admin/ops/finance/approver can view all profiles" on profiles;

-- Same issue on the update policy — drop it; admin updates go through the
-- service-role client anyway.
drop policy if exists "Admin/ops/owner can update any profile" on profiles;
drop policy if exists "Admin/ops can update any profile" on profiles;

-- Keep the non-recursive self-view / self-update / insert policies from migration 001.
-- If you ever need a non-admin role (e.g. support) to read other profiles via the
-- user-scoped client, create a SECURITY DEFINER function that checks the role and
-- use it in the policy — do NOT query profiles directly from a policy on profiles.
