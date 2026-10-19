// Manual refund request-and-track workflow. Deliberately not a gateway
// integration -- see the comment on refundRequests in shared/schema.ts for
// why. Ported from shopusa.co.ke's equivalent, scaled down for this
// project's simpler single-admin, no-RBAC model.
import { db } from "../../server/db";
import { orders, orderItems, refundRequests } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface RequestRefundInput {
  amount: number;
  reason: string;
  itemIds: string[] | null;
  requestedByEmail: string;
}

export type RefundActionResult =
  | { error: string }
  | { refundRequest: typeof refundRequests.$inferSelect };

export async function requestRefund(orderId: string, input: RequestRefundInput): Promise<RefundActionResult> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { error: "Order not found" };

  const existingOpen = await db
    .select()
    .from(refundRequests)
    .where(and(eq(refundRequests.orderId, orderId), eq(refundRequests.status, "requested")));
  if (existingOpen.length > 0) {
    return { error: "A refund has already been requested for this order and hasn't been resolved yet." };
  }

  // Check against every *fulfilled* refund too, not just open ones -- an
  // over-refund across two separate requests is exactly as real a mistake
  // as a double-refund from one. Small epsilon for float rounding.
  const fulfilled = await db
    .select()
    .from(refundRequests)
    .where(and(eq(refundRequests.orderId, orderId), eq(refundRequests.status, "fulfilled")));
  const alreadyRefunded = fulfilled.reduce((sum, r) => sum + r.amount, 0);
  const remaining = order.total - alreadyRefunded;

  if (input.amount > remaining + 0.01) {
    return { error: `That would refund more than this order's remaining balance (${order.currency} ${remaining.toFixed(2)} left to refund).` };
  }

  let items: { orderItemId: string; productName: string; quantity: number; totalPrice: number }[] | undefined;
  if (input.itemIds && input.itemIds.length > 0) {
    const rows = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const matched = rows.filter((r) => input.itemIds!.includes(r.id));
    if (matched.length === 0) {
      return { error: "Selected items were not found on this order." };
    }
    items = matched.map((r) => ({
      orderItemId: r.id,
      productName: r.productName,
      quantity: r.quantity,
      totalPrice: r.totalPrice,
    }));
  }

  const [refundRequest] = await db
    .insert(refundRequests)
    .values({
      orderId,
      amount: input.amount,
      reason: input.reason,
      items,
      status: "requested",
      requestedByEmail: input.requestedByEmail,
    })
    .returning();

  return { refundRequest };
}

export interface FulfillRefundInput {
  fulfilledByEmail: string;
  fulfillmentReference: string;
  fulfillmentNote?: string;
}

export async function fulfillRefundRequest(refundRequestId: string, input: FulfillRefundInput): Promise<RefundActionResult> {
  const [existing] = await db.select().from(refundRequests).where(eq(refundRequests.id, refundRequestId));
  if (!existing) return { error: "Refund request not found" };
  if (existing.status !== "requested") {
    return { error: `This refund request is already ${existing.status}.` };
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, existing.orderId));
  if (!order) return { error: "Order not found" };

  const [refundRequest] = await db
    .update(refundRequests)
    .set({
      status: "fulfilled",
      fulfilledByEmail: input.fulfilledByEmail,
      fulfilledAt: new Date(),
      fulfillmentReference: input.fulfillmentReference,
      fulfillmentNote: input.fulfillmentNote || null,
      updatedAt: new Date(),
    })
    .where(eq(refundRequests.id, refundRequestId))
    .returning();

  const fulfilled = await db
    .select()
    .from(refundRequests)
    .where(and(eq(refundRequests.orderId, existing.orderId), eq(refundRequests.status, "fulfilled")));
  const totalFulfilled = fulfilled.reduce((sum, r) => sum + r.amount, 0);
  const newPaymentStatus = totalFulfilled + 0.01 >= order.total ? "refunded" : "partially_refunded";

  await db
    .update(orders)
    .set({ paymentStatus: newPaymentStatus, updatedAt: new Date() })
    .where(eq(orders.id, existing.orderId));

  return { refundRequest };
}

export interface CancelRefundInput {
  cancelledByEmail: string;
  reason: string;
}

export async function cancelRefundRequest(refundRequestId: string, input: CancelRefundInput): Promise<RefundActionResult> {
  const [existing] = await db.select().from(refundRequests).where(eq(refundRequests.id, refundRequestId));
  if (!existing) return { error: "Refund request not found" };
  if (existing.status !== "requested") {
    return { error: `This refund request is already ${existing.status}.` };
  }

  const [refundRequest] = await db
    .update(refundRequests)
    .set({
      status: "cancelled",
      cancelledByEmail: input.cancelledByEmail,
      cancelledAt: new Date(),
      cancellationReason: input.reason,
      updatedAt: new Date(),
    })
    .where(eq(refundRequests.id, refundRequestId))
    .returning();

  return { refundRequest };
}

export async function getRefundRequestsForOrder(orderId: string) {
  return db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.orderId, orderId))
    .orderBy(desc(refundRequests.createdAt));
}
