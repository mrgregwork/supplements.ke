import { db } from "../../server/db";
import { sql } from "drizzle-orm";

// Short, human-readable, sequential order number (e.g. "SK-1042") instead of
// a random opaque code -- easy to read aloud or reference on a call. Backed
// by a Postgres SEQUENCE (order_number_seq) so nextval() is atomic: two
// simultaneous checkouts can never be handed the same number. Reserved the
// moment checkout starts (see checkout/init.ts) rather than only generated
// once an order is actually confirmed, so it can double as the M-Pesa/Card
// gateway's accountReference -- reusing the exact same code as the final
// order number (see checkoutFinalize.ts) means whatever a customer sees in
// their M-Pesa confirmation SMS always matches their order confirmation.
// Confirmed this doesn't introduce an IDOR risk -- the order number is never
// used anywhere as the sole credential for returning order data, only ever
// alongside a real session/ownership or admin check. Existing orders keep
// their old random-style numbers; this only applies going forward.
export async function generateOrderCode(prefix: string): Promise<string> {
  const safePrefix = (prefix || "OR").toUpperCase();
  const result = await db.execute(sql`SELECT nextval('order_number_seq') AS n`);
  const n = (result.rows[0] as { n: string | number }).n;
  return `${safePrefix}-${n}`;
}
