-- Phase 1: Agency and Editor roles + partner profile fields.
-- Creators and agencies now sign up before submitting intake forms.
-- Agencies can submit multiple profiles and track them via /partner dashboard.

alter type user_role add value if not exists 'agency';
alter type user_role add value if not exists 'editor';

alter table profiles
  add column if not exists partner_type text
    check (partner_type in ('creator', 'agency')),
  add column if not exists agency_website text,
  add column if not exists agency_contact_pic text;

-- Backfill existing influencer-role profiles as 'creator' partner_type
update profiles set partner_type = 'creator'
  where role = 'influencer' and partner_type is null;

-- Agencies read own profile (already covered by existing "Users can view own profile")
-- No extra profile RLS needed here; ensure-profile API uses service role for writes.
