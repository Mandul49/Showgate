ALTER TABLE events ADD COLUMN IF NOT EXISTS payout_subaccount_code text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS payout_subaccount_mode text;
CREATE TABLE IF NOT EXISTS organizer_subaccounts (
  id varchar(36) PRIMARY KEY,
  organizer_id varchar(36) NOT NULL,
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  subaccount_code text NOT NULL,
  mode text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizer_subaccounts_unique ON organizer_subaccounts (organizer_id, bank_code, account_number, mode);
