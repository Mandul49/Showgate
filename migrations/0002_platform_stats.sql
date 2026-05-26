CREATE TABLE IF NOT EXISTS "platform_stats" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "deleted_events" integer NOT NULL DEFAULT 0,
  "deleted_tickets_sold" integer NOT NULL DEFAULT 0
);

INSERT INTO "platform_stats" ("id", "deleted_events", "deleted_tickets_sold")
VALUES (1, 0, 0)
ON CONFLICT ("id") DO NOTHING;
