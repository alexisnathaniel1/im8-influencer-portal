-- Migration 053: AI summary + next steps for partner inbox emails
ALTER TABLE inbox_emails
  ADD COLUMN IF NOT EXISTS ai_summary    text,
  ADD COLUMN IF NOT EXISTS ai_next_steps text[] default '{}';
