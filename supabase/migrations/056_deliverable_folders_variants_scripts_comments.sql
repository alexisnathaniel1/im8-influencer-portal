-- Per-deliverable Drive subfolder, variant labelling on submissions,
-- script flag, and partner-visible comment thread.

-- 1. Per-deliverable Drive subfolder (holds all assets, scripts for that deliverable)
ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS drive_folder_id text;
COMMENT ON COLUMN deliverables.drive_folder_id IS
  'Drive subfolder under the deal contract folder, holds all submitted assets for this deliverable';

-- 2. Variant labelling on submissions + script flag
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS variant_label text,
  ADD COLUMN IF NOT EXISTS is_script     boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN submissions.variant_label IS
  'Free-text asset label e.g. "Hook 1", "Full Reel 2", "Body" — distinguishes assets within the same deliverable';
COMMENT ON COLUMN submissions.is_script IS
  'When true, this submission is a script / reference doc rather than reviewable content. Filtered from the review queue, no Slack notify, auto-approved on insert.';

-- 3. Partner-visible comment flag on deliverable_comments (table created in 021)
ALTER TABLE deliverable_comments
  ADD COLUMN IF NOT EXISTS visible_to_partner boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN deliverable_comments.visible_to_partner IS
  'When true, the partner (creator/agency) sees this comment on their dashboard. Otherwise it is internal-only.';

-- 4. Replace the admin-only RLS policy so partners can see + post their own.
DROP POLICY IF EXISTS "Admin/ops can manage deliverable comments" ON deliverable_comments;

CREATE POLICY "Admin staff full access to deliverable comments"
  ON deliverable_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management', 'support', 'ops')
    )
  );

CREATE POLICY "Partners read partner-visible comments on their own deliverables"
  ON deliverable_comments FOR SELECT
  USING (
    visible_to_partner = true
    AND EXISTS (
      SELECT 1 FROM deliverables d
      JOIN deals deal ON deal.id = d.deal_id
      WHERE d.id = deliverable_comments.deliverable_id
        AND deal.influencer_profile_id = auth.uid()
    )
  );

CREATE POLICY "Partners can post comments on their own deliverables"
  ON deliverable_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM deliverables d
      JOIN deals deal ON deal.id = d.deal_id
      WHERE d.id = deliverable_comments.deliverable_id
        AND deal.influencer_profile_id = auth.uid()
    )
  );
