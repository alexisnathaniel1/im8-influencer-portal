-- Ensure PostgREST schema cache is up to date with all columns added in
-- migrations 031 (contract_sequence, previous_deal_id) and 035 (influencer_email).
-- Safe to run multiple times — notify is idempotent.
notify pgrst, 'reload schema';
