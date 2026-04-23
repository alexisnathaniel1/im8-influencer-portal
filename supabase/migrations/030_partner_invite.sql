-- Partner invite token on deals
alter table deals
  add column if not exists partner_invite_token text unique,
  add column if not exists partner_invite_sent_at timestamptz;
