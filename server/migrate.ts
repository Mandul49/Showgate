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
    console.log("[migrations] cover_image_position_y column ready");
  } catch (err: any) {
    console.error("[migrations] startup migration error (non-fatal):", err?.message ?? err);
  }
}
