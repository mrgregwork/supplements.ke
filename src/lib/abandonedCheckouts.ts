// Abandoned-checkout tracking. An "abandoned checkout" is simply a
// pending_orders row that never got finalized into a real order -- no new
// capture step needed, checkout/init.ts already writes one of these the
// moment a customer starts paying. A row only counts as abandoned once it's
// been sitting for a while (ABANDONED_AFTER_MINUTES), so a checkout that's
// still genuinely in progress right now doesn't show up as abandoned.
import { db } from "../../server/db";
import { pendingOrders } from "@shared/schema";
import { eq, and, isNull, lt, sql, desc } from "drizzle-orm";

const ABANDONED_AFTER_MINUTES = 30;

export async function getAbandonedCheckouts(filter: "active" | "dismissed" | "all" = "active") {
  const cutoff = sql`now() - interval '${sql.raw(String(ABANDONED_AFTER_MINUTES))} minutes'`;

  const base = and(
    eq(pendingOrders.status, "pending"),
    isNull(pendingOrders.orderId),
    lt(pendingOrders.createdAt, cutoff),
  );

  const where =
    filter === "active" ? and(base, isNull(pendingOrders.abandonedDismissedAt)) :
    filter === "dismissed" ? and(base, sql`${pendingOrders.abandonedDismissedAt} IS NOT NULL`) :
    base;

  return db
    .select()
    .from(pendingOrders)
    .where(where)
    .orderBy(desc(pendingOrders.createdAt));
}

export async function markAbandonedCheckoutContacted(id: string) {
  const [row] = await db
    .update(pendingOrders)
    .set({ abandonedContactedAt: new Date(), updatedAt: new Date() })
    .where(eq(pendingOrders.id, id))
    .returning();
  return row ?? null;
}

export async function dismissAbandonedCheckout(id: string) {
  const [row] = await db
    .update(pendingOrders)
    .set({ abandonedDismissedAt: new Date(), updatedAt: new Date() })
    .where(eq(pendingOrders.id, id))
    .returning();
  return row ?? null;
}

export async function restoreAbandonedCheckout(id: string) {
  const [row] = await db
    .update(pendingOrders)
    .set({ abandonedDismissedAt: null, updatedAt: new Date() })
    .where(eq(pendingOrders.id, id))
    .returning();
  return row ?? null;
}
