-- Allow deals to skip management approval (e.g. gifted collabs, low-value partnerships)
alter table deals
  add column if not exists needs_approval boolean not null default true;
