CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

INSERT INTO "platform_settings" ("key", "value") VALUES
  ('platform_fee_percent', '2.5'),
  ('pro_monthly_price_kobo', '1200000'),
  ('pro_yearly_price_kobo', '12000000'),
  ('free_max_monthly_tickets', '500'),
  ('free_max_active_events', '1'),
  ('maintenance_mode', 'false')
ON CONFLICT ("key") DO NOTHING;
