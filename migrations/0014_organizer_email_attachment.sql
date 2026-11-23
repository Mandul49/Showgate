ALTER TABLE organizer_email_sends ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE organizer_email_sends ADD COLUMN IF NOT EXISTS attachment_size integer;
