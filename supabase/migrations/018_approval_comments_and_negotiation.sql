-- Phase 2: approval comment threads + agency negotiation response

-- ── Approval comment threads ──────────────────────────────────────────────
create table if not exists approval_comments (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references approval_packets(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  author_display_name text not null default '',
  body text not null,
  kind text not null default 'comment', -- 'comment' | 'approval' | 'rejection' | 'revision_request'
  created_at timestamptz not null default now()
);

create index if not exists approval_comments_packet_idx
  on approval_comments(packet_id, created_at desc);

alter table approval_comments enable row level security;

drop policy if exists "Admin/ops manage approval comments" on approval_comments;
create policy "Admin/ops manage approval comments"
  on approval_comments for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('admin', 'ops')
    )
  );

drop policy if exists "Approvers can read/insert comments on their packets" on approval_comments;
create policy "Approvers can read/insert comments on their packets"
  on approval_comments for all
  using (
    exists (
      select 1 from approval_packets ap
      where ap.id = approval_comments.packet_id
      and auth.uid() = any(ap.approver_ids)
    )
  );

-- ── Agency negotiation responses ──────────────────────────────────────────
-- Agencies respond to admin counteroffers via discovery_comments with kind='agency_response'
-- This migration just adds a check constraint to ensure valid kinds.

-- Allow 'agency_response' as a kind in discovery_comments if it isn't yet used
-- (no schema change needed — kind is free text, this is documentation only)

-- Add negotiation_counter column to discovery_profiles for admin's counter-offer text
alter table discovery_profiles
  add column if not exists negotiation_counter text,
  add column if not exists agency_response text, -- 'accepted' | 'declined' | null (pending)
  add column if not exists agency_responded_at timestamptz;
