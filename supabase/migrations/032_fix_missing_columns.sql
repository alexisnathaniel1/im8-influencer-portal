-- Idempotent: ensures gifted-collab columns exist on deals.
-- Safe to re-run even if migration 008 was already applied.
alter table deals
  add column if not exists is_gifted boolean not null default false,
  add column if not exists gifted_product text,
  add column if not exists gifted_quantity integer not null default 1,
  add column if not exists product_sent_at date;

-- Refresh PostgREST schema cache so the new columns are immediately visible.
notify pgrst, 'reload schema';
