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
    console.log("[migrations] cover_image_position_y column ready");
  } catch (err: any) {
    console.error("[migrations] startup migration error (non-fatal):", err?.message ?? err);
  }
}
