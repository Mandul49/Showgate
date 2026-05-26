ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended" boolean NOT NULL DEFAULT false;
