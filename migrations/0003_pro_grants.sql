CREATE TABLE IF NOT EXISTS "pro_grants" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "granted_by" varchar(36) NOT NULL,
  "note" text NOT NULL,
  "granted_at" timestamp DEFAULT now() NOT NULL
);
