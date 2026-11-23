import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession, getOrderWithItems } from "@lib/admin";
import { getRefundRequestsForOrder } from "@lib/refunds";
import { getSiteSettings } from "@lib/settings";
import { buildOrderReceiptPdf } from "@lib/receiptPdf";

// Admin-only, full-detail order PDF -- status, payment reference, customer
// block, shipping address, refund history (including which admin processed
// each action). Used only by the order page's own "Download PDF" button,
// never sent to a customer. See receipt.pdf.ts for the plain, customer-safe
// counterpart.
export const GET: APIRoute = async ({ params, request }) => {
  const sessionToken = getAdminSessionToken(request);
  const sessionData = await verifyAdminSession(sessionToken);

  if (!import.meta.env.DEV && !sessionData) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { id: orderId } = params;
  if (!orderId) {
    return new Response(JSON.stringify({ error: "Order ID is required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const order = await getOrderWithItems(orderId);
  if (!order) {
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  const [refundRequests, siteSettings] = await Promise.all([
    getRefundRequestsForOrder(order.id),
    getSiteSettings(),
  ]);

  const pdf = await buildOrderReceiptPdf(
    siteSettings.siteName,
    order,
    order.items,
    refundRequests.length > 0 ? refundRequests : undefined,
  );

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.orderNumber.replace(/[^a-zA-Z0-9-]/g, "")}.pdf"`,
    },
  });
};
