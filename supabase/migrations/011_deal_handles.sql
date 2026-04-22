alter table deals
  add column if not exists instagram_handle text,
  add column if not exists tiktok_handle text,
  add column if not exists youtube_handle text;
