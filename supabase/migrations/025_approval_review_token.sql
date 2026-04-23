-- Add a review token to approval packets for public (no-login) email review links
alter table approval_packets
  add column if not exists review_token text unique;
