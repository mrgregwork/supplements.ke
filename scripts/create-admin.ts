/**
 * create-admin.ts
 *
 * Creates (or re-points) an admin user for OTP login.
 *
 *   npx tsx scripts/create-admin.ts you@yourdomain.com "Your Name"
 *
 * The admin_users.password_hash column is NOT NULL, but OTP login never reads
 * it. This script stores a random, unusable hash so password login is
 * effectively disabled for the account and the emailed one-time code is the
 * only way in. That avoids seeding a known weak password on a live store —
 * unlike scripts/seed-admin.ts, which hardcodes admin@example.com / admin123
 * and should not be used against production.
 */

// Side-effect import, kept first: ESM evaluates imported modules in declaration
// order, so this populates DATABASE_URL before server/db.ts reads it at import
// time. A `config()` call in the module body would run too late.
import "dotenv/config";

import { db } from "../server/db";
import { adminUsers } from "../shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const name = process.argv[3]?.trim() || "Admin";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> [name]");
    console.error("The email must be a mailbox you can actually receive the OTP at.");
    process.exit(1);
  }

  // Random, unrecoverable hash: password login is disabled, OTP only.
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(crypto.randomBytes(32).toString("hex"), salt, 64).toString("hex");
  const passwordHash = `${salt}:${hash}`;

  const existing = await db.select().from(adminUsers).where(eq(adminUsers.email, email));

  if (existing.length > 0) {
    console.log(`Admin already exists: ${email} — leaving it untouched.`);
  } else {
    await db.insert(adminUsers).values({ email, passwordHash, name });
    console.log(`Created admin: ${email} (${name})`);
    console.log("Password login is disabled for this account; sign in with the emailed OTP.");
  }

  const all = await db.select().from(adminUsers);
  console.log(`\nadmin_users now contains ${all.length} row(s):`);
  for (const a of all) console.log(`  - ${a.email} (${a.name})`);

  process.exit(0);
}

main().catch(err => {
  console.error("Failed to create admin:", err);
  process.exit(1);
});
