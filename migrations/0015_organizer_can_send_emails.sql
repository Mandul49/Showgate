ALTER TABLE organizers ADD COLUMN IF NOT EXISTS can_send_emails boolean NOT NULL DEFAULT true;
