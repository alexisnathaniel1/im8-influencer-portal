-- Ads team columns on deliverables.
--
-- When a deliverable has WHITELIST or PAID_AD on the parent deal, the ads team
-- needs to track: has it been scheduled as an ad yet, are the usage rights
-- granted in the ad platform, and (if whitelisted) the start/end of the
-- whitelisting window.
alter table deliverables
  add column if not exists scheduled_for_ads boolean not null default false,
  add column if not exists ad_usage_rights_status text,
  -- free-form for now: e.g. 'granted', 'pending', 'not_needed'
  add column if not exists whitelisting_granted boolean not null default false,
  add column if not exists whitelisted_start_date date,
  add column if not exists whitelisted_end_date date;

notify pgrst, 'reload schema';
