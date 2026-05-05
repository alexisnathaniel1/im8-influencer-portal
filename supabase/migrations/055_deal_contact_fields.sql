-- Add contact phone and manager email to deals table for bulk-upload and partner tracker
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS contact_phone  text,
  ADD COLUMN IF NOT EXISTS manager_email  text;
