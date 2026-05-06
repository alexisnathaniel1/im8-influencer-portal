-- Submissions can now bundle multiple assets under a single review card.
-- The primary asset stays on the existing drive_url / drive_file_id / file_name
-- columns; additional variants live in this JSONB array. Each entry shape:
--   {
--     "asset_type": "full_reel" | "hook" | "main_body" | "cta" | "script" | "drive_folder",
--     "drive_url":  text,
--     "drive_file_id": text | null,
--     "file_name":  text,
--     "label":      text | null   -- e.g. "Hook 1", "Full Reel 2"
--   }

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN submissions.variants IS
  'Additional asset variants attached to the same submission (multi-asset deliveries like Rose Harvey''s 7-file IGR). Primary asset still lives on drive_url/drive_file_id/file_name with variant_label as its asset_type.';
