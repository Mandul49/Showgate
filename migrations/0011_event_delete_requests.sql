ALTER TABLE events ADD COLUMN IF NOT EXISTS delete_requested_at TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS delete_request_reason TEXT;
