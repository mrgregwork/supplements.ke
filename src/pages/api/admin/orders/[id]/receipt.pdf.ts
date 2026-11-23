import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession, getOrderWithItems } from "@lib/admin";
import { getSiteSettings } from "@lib/settings";
import { buildPlainOrderReceiptPdf } from "@lib/receiptPdf";

// Plain, customer-safe order PDF -- order number/date, payment method,
// items, totals, thank-you line. No status, no payment reference, no
// customer block, no refund history: this is the one shape that could ever
// safely be shown to or sent to a customer. See receipt-full.pdf.ts for the
// admin-only, full-detail counterpart used by the order page's own
// "Download PDF" button.
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

  const siteSettings = await getSiteSettings();

  // This site's real wordmark logo (unlike supplements.co.ke, which has no
  // uploaded-logo feature at all) -- same file Header.astro's light-background
  // header already shows. Fetched over HTTP from this same running server,
  // same approach cosmetics.ke/store-template use for their own admin-
  // uploaded logos, so it works identically in dev and the built output.
  let logo: Buffer | null = null;
  try {
    const origin = new URL(request.url).origin;
    const logoRes = await fetch(`${origin}/images/logo.png`);
    if (logoRes.ok) logo = Buffer.from(await logoRes.arrayBuffer());
  } catch {
    // Logo is cosmetic -- never fail the PDF over it.
  }

  const pdf = await buildPlainOrderReceiptPdf(siteSettings.siteName, order, order.items, logo);

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${siteSettings.siteName.replace(/["\\]/g, "")} Receipt #${order.orderNumber.replace(/["\\]/g, "")}.pdf"`,
    },
  });
};
