-- Allow creators to counter-propose during negotiation, instead of only
-- accept/decline. Adds:
--   • discovery_status enum value 'creator_countered' so admins see a
--     dedicated triage state when the creator pushes back with new terms
--   • creator_counter_note column for any free-text the creator added
--     alongside their counter
--   • creator_response_at timestamp so the admin board can show recency
--
-- We do NOT add separate columns for the creator's rate/duration/deliverables
-- — instead the existing proposed_rate_cents / total_months / proposed_deliverables
-- always reflect the latest offer in the conversation, regardless of who
-- sent it. The status + agency_response fields tell us whose move it is.

alter type discovery_status add value if not exists 'creator_countered';

alter table discovery_profiles
  add column if not exists creator_counter_note text,
  add column if not exists creator_response_at timestamptz;

-- Reload PostgREST schema cache so the new enum value + columns are exposed.
notify pgrst, 'reload schema';
