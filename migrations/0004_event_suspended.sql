ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "suspended_by_admin" boolean NOT NULL DEFAULT false;
