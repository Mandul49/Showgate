import { sql } from "drizzle-orm";
import { db } from "./db";

export async function runMigrations(): Promise<void> {
  try {
    await db.execute(
      sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image_position_y integer DEFAULT 50`
    );
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gender text`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS age_range text`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS heard_from text`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS slug text`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS events_slug_unique ON events (slug) WHERE slug IS NOT NULL`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS instagram_url text`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS facebook_url text`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS twitter_url text`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS tiktok_url text`);
    await db.execute(sql`ALTER TABLE organizers ADD COLUMN IF NOT EXISTS branding_enabled boolean NOT NULL DEFAULT true`);
    await db.execute(sql`ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS attendee_details jsonb`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_unique ON orders (payment_reference) WHERE payment_reference IS NOT NULL`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS checked_in_seats jsonb`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS vip_guests jsonb`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS upgraded_seats jsonb`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at timestamp`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS delete_requested_at timestamp`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS delete_request_reason text`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS branding_override jsonb`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS organizer_email_sends (
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
)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS organizer_email_sends_event_created ON organizer_email_sends (event_id, created_at)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS organizer_email_unsubscribes (
  organizer_id varchar(36) NOT NULL,
  email text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (organizer_id, email)
)`);
    console.log("[migrations] cover_image_position_y column ready");
  } catch (err: any) {
    console.error("[migrations] startup migration error (non-fatal):", err?.message ?? err);
  }
}
