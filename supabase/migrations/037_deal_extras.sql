-- Add discount code and affiliate link to deals (visible to creators in their dashboard).
-- Also removes the unused exclusivity_clause column (replaced by contract_requirements).
alter table deals
  add column if not exists discount_code text,
  add column if not exists affiliate_link text;

-- Reload PostgREST schema cache so new columns are immediately queryable.
notify pgrst, 'reload schema';
