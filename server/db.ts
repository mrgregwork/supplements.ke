import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const dbUrl = (import.meta as any).env?.DATABASE_URL ?? process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: dbUrl,
  max: 3,                        // keep connection count low (Neon free tier)
  connectionTimeoutMillis: 15000, // 15s to establish connection (covers Neon cold-start)
  idleTimeoutMillis: 30000,       // close idle connections after 30s
  keepAlive: true,               // send TCP keepalives to detect dropped connections
});
export const db = drizzle(pool, { schema });
