-- Allow submissions without a deal (standalone/ambassador uploads)
ALTER TABLE submissions ALTER COLUMN deal_id DROP NOT NULL;

-- Per-deal Drive sub-folder (for agency accounts with multiple talent)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS drive_folder_id text;
