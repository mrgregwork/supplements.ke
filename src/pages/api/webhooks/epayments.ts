import type { APIRoute } from "astro";
import { verifyWebhookSignature } from "@lib/epayments";
import { finalizePendingOrder } from "@lib/checkoutFinalize";

export const prerender = false;

// E-Payments makes exactly one webhook delivery attempt, ever -- no retry on
// a non-2xx response (see docs/PAYMENT_INTEGRATION.md). That's why the
// client status-poll (api/checkout/status/[id].ts) and the reconciliation
// cron exist independently, not as a "just in case" -- they are load-bearing
// every time this webhook doesn't land on the first try, which will happen
// routinely, not as a rare edge case.
export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get("X-MPesa-Signature") ?? undefined;

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("E-Payments webhook: signature verification failed");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  let body: {
    event: string;
    data?: {
      metadata?: { pendingOrderId?: string };
      // The webhook payload is E-Payments' raw database row (camelCase JS
      // field names, e.g. `mpesaReceiptNumber`) -- NOT the same shape as
      // their public `GET /api/v1/transaction/:id` REST response, which
      // reshapes these same fields to snake_case for its own contract. Using
      // the REST API's snake_case shape here would silently drop the
      // receipt number on every webhook -- see docs/PAYMENT_INTEGRATION.md.
      resultDesc?: string | null;
      mpesaReceiptNumber?: string | null;
      checkoutRequestId?: string | null;
    };
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const pendingOrderId = body.data?.metadata?.pendingOrderId;
  if (!pendingOrderId) {
    // Not a checkout this app started, or missing metadata -- acknowledge so
    // E-Payments doesn't keep retrying delivery; there's nothing to do here.
    return new Response(JSON.stringify({ received: true }));
  }

  try {
    if (body.event === "payment.completed") {
      await finalizePendingOrder(pendingOrderId, "confirmed", {
        mpesaReceiptNumber: body.data?.mpesaReceiptNumber ?? null,
        cardReference: body.data?.checkoutRequestId ?? null,
      });
    } else if (body.event === "payment.failed") {
      await finalizePendingOrder(pendingOrderId, "failed", {
        gatewayMessage: body.data?.resultDesc ?? null,
      });
    }
    return new Response(JSON.stringify({ received: true }));
  } catch (err) {
    console.error("E-Payments webhook finalize failed:", err);
    return new Response(JSON.stringify({ error: "Failed to process webhook" }), { status: 500 });
  }
};
