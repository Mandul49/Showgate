#!/usr/bin/env node
// Usage: node scripts/make-admin.js manduljohnson@gmail.com
import pg from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/make-admin.js <email>");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query(
  "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role",
  [email]
);

if (result.rowCount === 0) {
  console.error(`No user found with email: ${email}`);
  await pool.end();
  process.exit(1);
}

console.log(`✓ ${result.rows[0].email} is now an admin (role = ${result.rows[0].role})`);
await pool.end();
