-- Widen "admin/ops" RLS policies across the whole admin surface to also include
-- 'management' and 'support' roles.
--
-- The codebase never had an 'ops' role — the original migrations were written before
-- the role names were finalised. As a result every table guarded by `role in ('admin','ops')`
-- silently blocks management and support users today. Migration 058 fixed this for
-- audit_events; 056 fixed it for deliverable_comments. This migration applies the
-- same widening to every other admin-panel table.
--
-- Pattern: drop the old policy by its exact name, recreate with admin/management/support.

-- ─────────────────────────────────────────────────────────────────────────────
-- discovery_profiles (migration 002)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops can read all discovery profiles" ON discovery_profiles;
CREATE POLICY "Admin staff can read all discovery profiles"
  ON discovery_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

DROP POLICY IF EXISTS "Admin/ops can insert/update discovery profiles" ON discovery_profiles;
CREATE POLICY "Admin staff can insert/update discovery profiles"
  ON discovery_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- deals (migration 003)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops/finance can read deals" ON deals;
CREATE POLICY "Admin staff can read deals"
  ON deals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

DROP POLICY IF EXISTS "Admin/ops can insert/update deals" ON deals;
CREATE POLICY "Admin staff can insert/update deals"
  ON deals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- approval_packets, approval_decisions (migration 004)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops can manage packets" ON approval_packets;
CREATE POLICY "Admin staff can manage packets"
  ON approval_packets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

DROP POLICY IF EXISTS "Admin/ops can view all decisions" ON approval_decisions;
CREATE POLICY "Admin staff can view all decisions"
  ON approval_decisions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- briefs, submissions, submission_ratings (migration 005)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops can manage briefs" ON briefs;
CREATE POLICY "Admin staff can manage briefs"
  ON briefs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

DROP POLICY IF EXISTS "Admin/ops can view all submissions" ON submissions;
CREATE POLICY "Admin staff can view all submissions"
  ON submissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

DROP POLICY IF EXISTS "Admin/ops can update submissions" ON submissions;
CREATE POLICY "Admin staff can update submissions"
  ON submissions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

DROP POLICY IF EXISTS "Admin/ops can manage ratings" ON submission_ratings;
CREATE POLICY "Admin staff can manage ratings"
  ON submission_ratings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_reviews (migration 006)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops can view ai_reviews" ON ai_reviews;
CREATE POLICY "Admin staff can view ai_reviews"
  ON ai_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- deliverable_catalog (migration 016)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops can manage deliverables" ON deliverable_catalog;
CREATE POLICY "Admin staff can manage deliverable_catalog"
  ON deliverable_catalog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- discovery_comments (migration 017)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops manage all discovery comments" ON discovery_comments;
CREATE POLICY "Admin staff manage all discovery comments"
  ON discovery_comments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- approval_comments (migration 018)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops manage approval comments" ON approval_comments;
CREATE POLICY "Admin staff manage approval comments"
  ON approval_comments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- gifting_requests (migration 020)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops can manage gifting requests" ON gifting_requests;
CREATE POLICY "Admin staff can manage gifting requests"
  ON gifting_requests FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- deliverables tracker (migration 021)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops can manage deliverables" ON deliverables;
CREATE POLICY "Admin staff can manage deliverables"
  ON deliverables FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- edited videos pipeline (migration 022)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/ops can manage deal editors" ON deal_editors;
CREATE POLICY "Admin staff can manage deal editors"
  ON deal_editors FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

DROP POLICY IF EXISTS "Admin/ops can manage edited videos" ON edited_videos;
CREATE POLICY "Admin staff can manage edited videos"
  ON edited_videos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management', 'support')
  ));

DROP POLICY IF EXISTS "Admin/ops/editor/influencer can comment on edited videos" ON edited_video_comments;
CREATE POLICY "Admin staff/editor/influencer can comment on edited videos"
  ON edited_video_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management', 'support', 'editor', 'influencer')
    )
  );
