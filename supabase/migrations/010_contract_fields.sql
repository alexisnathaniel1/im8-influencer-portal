alter table deals
  add column if not exists contract_signed_at date,
  add column if not exists contract_url text,
  add column if not exists contract_requirements text,
  add column if not exists payment_terms text,
  add column if not exists exclusivity_clause text;
