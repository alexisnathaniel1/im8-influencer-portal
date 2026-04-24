-- Currency for paid deal amounts. Defaults to USD so existing deals stay
-- unchanged. Rate fields (monthly_rate_cents, total_rate_cents) stay as cents
-- in the chosen currency — no automatic conversion for now.
alter table deals
  add column if not exists currency_code text default 'USD';

notify pgrst, 'reload schema';
