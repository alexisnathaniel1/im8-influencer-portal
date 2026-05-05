-- Migration 051: Brief timestamps, auto due dates, and partner inbox table

-- 1. Add timestamp columns to deliverables for brief send tracking
ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS brief_sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS brief_sent_by        uuid references profiles(id) on delete set null,
  ADD COLUMN IF NOT EXISTS admin_review_due_date date;

-- 2. Partner inbox emails table (IMAP sync from partners@im8health.com)
CREATE TABLE IF NOT EXISTS inbox_emails (
  id              uuid primary key default gen_random_uuid(),
  imap_uid        bigint not null,
  imap_account    text not null default 'partners@im8health.com',
  from_email      text not null,
  from_name       text,
  subject         text not null,
  body_text       text,
  received_at     timestamptz not null,
  is_read         boolean not null default false,
  linked_deal_id  uuid references deals(id) on delete set null,
  created_at      timestamptz not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inbox_emails_uid_account_idx
  ON inbox_emails(imap_account, imap_uid);

-- RLS: admin/management/support can read all; no partner access
ALTER TABLE inbox_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read inbox emails"
  ON inbox_emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management', 'support')
    )
  );

CREATE POLICY "Staff can update inbox emails"
  ON inbox_emails FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management', 'support')
    )
  );

CREATE POLICY "Service role can manage inbox emails"
  ON inbox_emails FOR ALL
  USING (auth.role() = 'service_role');
