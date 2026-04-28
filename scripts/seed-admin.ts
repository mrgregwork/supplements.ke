import { db } from "../server/db";
import { adminUsers } from "../shared/schema";
import crypto from "crypto";

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seedAdmin() {
  const email = "admin@example.com";
  const password = "admin123";
  const name = "Admin User";

  try {
    const passwordHash = await hashPassword(password);
    
    await db
      .insert(adminUsers)
      .values({ email, passwordHash, name })
      .onConflictDoNothing();
    
    console.log("Admin user created successfully!");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log("\nYou can now login at /admin/login");
  } catch (error) {
    console.error("Error seeding admin:", error);
  }
  
  process.exit(0);
}

seedAdmin();
