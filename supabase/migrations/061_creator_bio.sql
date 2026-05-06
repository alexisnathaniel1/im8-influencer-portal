-- Short creator bio shown on review cards so reviewers have context
-- about who the creator is (e.g. "Team GB marathon runner, top 10 at London 2024").
-- Distinct from `rationale`, which is the deal-specific approval reasoning.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS creator_bio text;

COMMENT ON COLUMN deals.creator_bio IS
  'Short 2-3 sentence creator bio for reviewer context. Surfaced on the review queue and deal detail page.';
