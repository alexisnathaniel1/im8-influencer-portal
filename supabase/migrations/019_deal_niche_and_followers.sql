-- Add niche tags and follower count to deals so they auto-populate from discovery profiles
alter table deals
  add column if not exists niche_tags text[] default '{}',
  add column if not exists follower_count int;
