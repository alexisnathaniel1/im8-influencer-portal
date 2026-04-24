-- Add influencer_email to discovery_profiles so we can link a creator's portal
-- account to their submission even when an admin or agency submitted on their behalf.
--
-- Populated from: the counter-proposal "to" email (admin fills this in when
-- sending a negotiation email), or at intake-form submission time when the
-- creator submits themselves (in that case it equals submitter_email).
--
-- Used by ensure-profile to auto-link accounts on signup/login, and by
-- discovery → deal creation to set the correct influencer_email on the deal.

ALTER TABLE discovery_profiles
  ADD COLUMN IF NOT EXISTS influencer_email text;

-- Back-fill: for self-submitted profiles (where creator IS the submitter)
-- the two emails are the same, so copy submitter_email as a baseline.
-- Admin-submitted rows stay NULL until the next counter-proposal is sent.
UPDATE discovery_profiles
SET influencer_email = submitter_email
WHERE influencer_email IS NULL
  AND submitter_email IS NOT NULL
  AND submitter_email != '';
