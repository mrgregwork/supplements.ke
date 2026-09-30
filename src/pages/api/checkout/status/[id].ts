import type { APIRoute } from "astro";
import { db } from "../../../../../server/db";
import { orders, pendingOrders } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getTransactionStatus } from "@lib/epayments";
import { finalizePendingOrder } from "@lib/checkoutFinalize";

export const prerender = false;

// One of the three independent paths that can resolve a pending order (see
// checkoutFinalize.ts) -- the customer's browser calls this while the
// "waiting for payment" screen is open. Actively re-checks the gateway
// itself rather than just reading the DB, since E-Payments' webhook is a
// single delivery attempt and may never arrive at all.
export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing order id" }), { status: 400 });
  }

  const [pending] = await db.select().from(pendingOrders).where(eq(pendingOrders.id, id));
  if (!pending) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  if (pending.status === "pending" && pending.gatewayTransactionId) {
    try {
      const txn = await getTransactionStatus(pending.gatewayTransactionId);
      if (txn.status === "completed") {
        await finalizePendingOrder(id, "confirmed", {
          mpesaReceiptNumber: txn.mpesaReceiptNumber,
          cardReference: txn.checkoutRequestId,
        });
      } else if (txn.status === "failed") {
        await finalizePendingOrder(id, "failed", { gatewayMessage: txn.resultDesc });
      }
      // "pending"/anything else: leave the row alone, poll again shortly.
    } catch (err) {
      // A gateway lookup failure here is not itself a checkout failure --
      // just report current state and let the client retry.
      console.error("Checkout status poll: gateway lookup failed", err);
    }
  }

  const [current] = await db.select().from(pendingOrders).where(eq(pendingOrders.id, id));

  let orderNumber: string | null = null;
  if (current.orderId) {
    const [order] = await db.select({ orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, current.orderId));
    orderNumber = order?.orderNumber ?? null;
  }

  return new Response(
    JSON.stringify({
      status: current.status,
      orderId: current.orderId,
      orderNumber,
      gatewayMessage: current.gatewayMessage,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
