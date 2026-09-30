import { db } from "../../server/db";
import { orders, orderItems, pendingOrders } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { sendOrderConfirmationEmail } from "../../server/email";
import { generateOrderCode } from "./orderCode";

// The single place a checkout attempt gets turned into a real order. Called
// from three independent, race-prone paths -- the E-Payments webhook, the
// customer's browser polling for status, and the reconciliation cron -- any
// of which might reach this function for the same pending order, possibly
// at nearly the same instant. Same pattern as cosmetics.ke's
// checkoutFinalize.ts; see docs/PAYMENT_INTEGRATION.md for why the shape
// below is not optional scaffolding.

export type FinalizeOutcome = "confirmed" | "failed";

export interface FinalizeGatewayFields {
  gatewayTransactionId?: string | null;
  mpesaReceiptNumber?: string | null;
  cardReference?: string | null;
  gatewayMessage?: string | null;
}

export interface FinalizeResult {
  pendingOrderId: string;
  status: string;
  orderId: string | null;
  orderNumber: string | null;
  /** true only when THIS call is the one that actually resolved the row -- a later duplicate call sees this as false. */
  wasFinalizedByThisCall: boolean;
}

export async function finalizePendingOrder(
  pendingOrderId: string,
  outcome: FinalizeOutcome,
  gatewayFields: FinalizeGatewayFields = {},
): Promise<FinalizeResult> {
  // Everything below -- the atomic guard AND the order creation -- runs in
  // ONE transaction. If the guard UPDATE committed on its own and order
  // creation then failed for any reason (a bad product id, a DB hiccup), the
  // pending order would be stuck "confirmed" with no real order ever created
  // and no way for the webhook/poll/cron to retry it, since none of them
  // touch a row outside ('pending','failed'). Keeping both in one
  // transaction means any failure rolls the status flip back too, so a
  // later attempt can still resolve it correctly.
  let order: typeof orders.$inferSelect | null = null;

  const guardResult = await db.transaction(async (tx) => {
    // The one line that makes three independent, uncoordinated callers safe
    // to race: whichever request's UPDATE reaches Postgres first is the
    // only one that can ever move this row out of ('pending','failed') with
    // order_id still NULL. Everything after that sees order_id already set
    // and must not create a second order.
    const updatedRows = await tx.execute(sql`
      UPDATE pending_orders
      SET status = ${outcome},
          gateway_transaction_id = COALESCE(${gatewayFields.gatewayTransactionId ?? null}, gateway_transaction_id),
          mpesa_receipt_number = COALESCE(${gatewayFields.mpesaReceiptNumber ?? null}, mpesa_receipt_number),
          card_reference = COALESCE(${gatewayFields.cardReference ?? null}, card_reference),
          gateway_message = COALESCE(${gatewayFields.gatewayMessage ?? null}, gateway_message),
          updated_at = now()
      WHERE id = ${pendingOrderId} AND status IN ('pending', 'failed') AND order_id IS NULL
      RETURNING *
    `);

    const rows = updatedRows.rows as any[];
    if (rows.length === 0) {
      return { won: false as const };
    }

    const pending = rows[0];

    if (outcome === "failed") {
      return { won: true as const, pending, order: null };
    }

    // Reuse the code generated at checkout/init.ts time (sent to E-Payments
    // as the M-Pesa/Paystack reference, so it's what the customer's own
    // confirmation SMS shows) as the real order's number -- so the
    // reference the customer already saw and the order confirmation always
    // match. Falls back to generating a fresh one only for a pending_orders
    // row created before this column existed (order_code NULL).
    const orderNumber = pending.order_code ?? generateOrderCode();

    const [newOrder] = await tx
      .insert(orders)
      .values({
        orderNumber,
        customerId: pending.customer_id,
        email: pending.email,
        phone: pending.phone,
        status: "confirmed",
        paymentMethod: pending.payment_method,
        paymentStatus: "paid",
        gatewayTransactionId: pending.gateway_transaction_id,
        mpesaReceiptNumber: pending.mpesa_receipt_number,
        cardReference: pending.card_reference,
        subtotal: pending.subtotal,
        tax: pending.tax,
        shipping: pending.shipping,
        total: pending.total,
        currency: pending.currency,
        shippingAddress: pending.shipping_address,
        notes: pending.notes,
      })
      .returning();

    const snapshot = pending.items as {
      productId: string;
      productName: string;
      productImage: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[];

    for (const item of snapshot) {
      await tx.insert(orderItems).values({
        orderId: newOrder.id,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      });
    }

    await tx.update(pendingOrders).set({ orderId: newOrder.id, updatedAt: sql`now()` }).where(eq(pendingOrders.id, pendingOrderId));

    return { won: true as const, pending, order: newOrder };
  });

  if (!guardResult.won) {
    // Either this pending order doesn't exist, or a different caller already
    // won the race -- read back the current state as a safe no-op result.
    const [existing] = await db.select().from(pendingOrders).where(eq(pendingOrders.id, pendingOrderId));
    return {
      pendingOrderId,
      status: existing?.status ?? "unknown",
      orderId: existing?.orderId ?? null,
      orderNumber: null,
      wasFinalizedByThisCall: false,
    };
  }

  if (outcome === "failed" || !guardResult.order) {
    return {
      pendingOrderId,
      status: "failed",
      orderId: null,
      orderNumber: null,
      wasFinalizedByThisCall: true,
    };
  }

  order = guardResult.order;

  // Best-effort, after commit -- an email failure must never undo an
  // already-paid order.
  sendOrderConfirmationEmail({
    to: order.email,
    orderNumber: order.orderNumber,
    currency: order.currency,
    total: order.total,
  }).catch(() => {
    // Deliberately swallowed -- see comment above. A missing/unconfigured
    // RESEND_API_KEY must never fail an already-paid checkout.
  });

  return {
    pendingOrderId,
    status: "confirmed",
    orderId: order.id,
    orderNumber: order.orderNumber,
    wasFinalizedByThisCall: true,
  };
}
