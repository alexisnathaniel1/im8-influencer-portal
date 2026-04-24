-- Defensive migration: ensures every discovery_source value the app uses
-- actually exists in the enum, regardless of which earlier migrations ran.
-- Safe to re-run.
alter type discovery_source add value if not exists 'inbound_form';
alter type discovery_source add value if not exists 'intake_form';
alter type discovery_source add value if not exists 'agency_email';
alter type discovery_source add value if not exists 'manual';

notify pgrst, 'reload schema';
