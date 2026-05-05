-- Migration 055: Brief comments — two-way thread between creator and admin team

CREATE TABLE IF NOT EXISTS brief_comments (
  id           uuid primary key default gen_random_uuid(),
  brief_id     uuid not null references briefs(id) on delete cascade,
  deal_id      uuid references deals(id) on delete set null,
  author_id    uuid not null references profiles(id) on delete cascade,
  author_name  text not null,
  author_role  text not null default 'creator', -- 'creator' | 'admin' | 'management' | 'support'
  body         text not null,
  read_by_admin boolean not null default false,  -- only meaningful when author_role='creator'
  created_at   timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS brief_comments_brief_idx     ON brief_comments(brief_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brief_comments_unread_idx    ON brief_comments(read_by_admin) WHERE read_by_admin = false;

ALTER TABLE brief_comments ENABLE ROW LEVEL SECURITY;

-- Staff: full read + insert + update on all
CREATE POLICY "Staff read all brief_comments"
  ON brief_comments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin','management','support'))
  );

CREATE POLICY "Staff insert brief_comments"
  ON brief_comments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin','management','support'))
  );

CREATE POLICY "Staff update brief_comments"
  ON brief_comments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin','management','support'))
  );

-- Creators: read+insert on their own brief threads
CREATE POLICY "Creators read own brief_comments"
  ON brief_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM briefs b
      JOIN deals d ON d.id = b.deal_id
      WHERE b.id = brief_comments.brief_id
      AND d.influencer_profile_id = auth.uid()
    )
  );

CREATE POLICY "Creators insert own brief_comments"
  ON brief_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM briefs b
      JOIN deals d ON d.id = b.deal_id
      WHERE b.id = brief_comments.brief_id
      AND d.influencer_profile_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access"
  ON brief_comments FOR ALL
  USING (auth.role() = 'service_role');
