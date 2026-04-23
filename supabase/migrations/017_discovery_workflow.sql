-- Phase 1: extended discovery statuses + comment thread per submission.
-- Admin can leave comments visible to the agency/creator (via /partner dashboard)
-- or internal comments (admin/ops only).

alter type discovery_status add value if not exists 'submitted';
alter type discovery_status add value if not exists 'approved';
alter type discovery_status add value if not exists 'negotiation_needed';

-- Discovery comment thread
create table if not exists discovery_comments (
  id uuid primary key default gen_random_uuid(),
  discovery_profile_id uuid not null references discovery_profiles(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  author_display_name text not null default '',
  body text not null,
  visible_to_partner boolean not null default false,
  kind text not null default 'comment', -- 'comment' | 'notify' | 'status_change'
  created_at timestamptz not null default now()
);

create index if not exists discovery_comments_profile_idx
  on discovery_comments(discovery_profile_id, created_at desc);

alter table discovery_comments enable row level security;

drop policy if exists "Admin/ops manage all discovery comments" on discovery_comments;
create policy "Admin/ops manage all discovery comments"
  on discovery_comments for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('admin', 'ops')
    )
  );

drop policy if exists "Partner reads visible comments on own submissions" on discovery_comments;
create policy "Partner reads visible comments on own submissions"
  on discovery_comments for select
  using (
    visible_to_partner = true
    and exists (
      select 1 from discovery_profiles dp
      join profiles p on p.id = auth.uid()
      where dp.id = discovery_comments.discovery_profile_id
      and (
        dp.submitted_by_profile_id = auth.uid()
        or lower(dp.submitter_email) = lower(p.email)
      )
    )
  );
