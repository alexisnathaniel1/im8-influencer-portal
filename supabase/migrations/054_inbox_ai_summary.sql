-- Migration 054: AI summary + next steps for partner inbox emails
-- Each next-step string is prefixed with "Team:" or "Creator:" to indicate assignee.
ALTER TABLE inbox_emails
  ADD COLUMN IF NOT EXISTS ai_summary    text,
  ADD COLUMN IF NOT EXISTS ai_next_steps text[] default '{}';
