import { db } from "../../server/db";
import { orderNotes } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

export async function addOrderNote(orderId: string, message: string, createdByEmail: string) {
  const [note] = await db
    .insert(orderNotes)
    .values({ orderId, message, createdByEmail })
    .returning();
  return note;
}

export async function getOrderNotes(orderId: string) {
  return db
    .select()
    .from(orderNotes)
    .where(eq(orderNotes.orderId, orderId))
    .orderBy(asc(orderNotes.createdAt));
}
