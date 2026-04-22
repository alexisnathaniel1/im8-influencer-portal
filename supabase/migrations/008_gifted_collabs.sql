-- Add gifted collaboration fields to deals
alter table deals
  add column if not exists is_gifted boolean not null default false,
  add column if not exists gifted_product text,
  add column if not exists gifted_quantity integer not null default 1,
  add column if not exists product_sent_at date;

-- gifted_product is one of the three IM8 products (stored as text, not enum, for flexibility)
-- gifted_quantity = number of units sent
-- product_sent_at = date product was dispatched
