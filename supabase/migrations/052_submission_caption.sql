-- Migration 052: Caption + separate caption-feedback on submissions
--
-- Captions go on the submission alongside the file so creators paste the
-- finished caption when uploading. Admins leave separate review notes for
-- the visual content vs the caption text — both can need fixes independently.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS caption          text,
  ADD COLUMN IF NOT EXISTS feedback_caption text;

COMMENT ON COLUMN submissions.feedback         IS 'Admin feedback on the visual content (video/image)';
COMMENT ON COLUMN submissions.feedback_caption IS 'Admin feedback on the caption text';

NOTIFY pgrst, 'reload schema';
