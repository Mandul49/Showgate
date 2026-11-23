CREATE TABLE IF NOT EXISTS organizer_email_sends (
  id varchar(36) PRIMARY KEY,
  event_id varchar(36) NOT NULL,
  organizer_id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sending',
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);
CREATE INDEX IF NOT EXISTS organizer_email_sends_event_created ON organizer_email_sends (event_id, created_at);
CREATE TABLE IF NOT EXISTS organizer_email_unsubscribes (
  organizer_id varchar(36) NOT NULL,
  email text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (organizer_id, email)
);
