import PDFDocument from "pdfkit";

// Same approach as shopusa.co.ke's shared/receiptPdf.ts (returns a Buffer so
// Astro's Response can stream it, since Express and Astro consume PDFKit
// output differently). Uses getSiteSettings() for the site name rather than
// a hardcoded logo/brand.
export type ReceiptShippingAddress = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

export type ReceiptOrder = {
  orderNumber: string;
  createdAt: string | Date;
  paymentMethod: string | null;
  mpesaReceiptNumber: string | null;
  cardReference: string | null;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  email: string;
  phone: string | null;
  shippingAddress: ReceiptShippingAddress | null;
};

export type ReceiptLineItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

// One row of refund_requests (any status) -- see src/lib/refunds.ts. Only
// ever passed on the admin-facing download (never a customer-facing one, if
// this is ever reused there), so it's fine to show which admin processed
// each action.
export type ReceiptRefund = {
  amount: number;
  reason: string;
  status: string;
  requestedByEmail: string;
  fulfilledByEmail: string | null;
  fulfillmentReference: string | null;
  fulfilledAt: string | Date | null;
  fulfillmentNote: string | null;
  cancelledByEmail: string | null;
  cancellationReason: string | null;
  cancelledAt: string | Date | null;
  createdAt: string | Date;
};

/**
 * Renders an order receipt PDF, with an optional "Refund history" section --
 * added so a refunded order's downloaded PDF can serve as a supporting
 * document proving a refund was actually requested/issued, not just a plain
 * purchase receipt (see AdminRefundPanel.tsx).
 *
 * `logo`, when provided, is the raw image bytes of whatever this site's
 * header already shows. Optional and never throws if missing/unreadable,
 * since a logo is cosmetic, not load-bearing -- the site name text is still
 * always printed either way.
 */
export function buildOrderReceiptPdf(
  siteName: string,
  order: ReceiptOrder,
  lineItems: ReceiptLineItem[],
  refunds?: ReceiptRefund[],
  logo?: Buffer | null,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (logo) {
      try {
        const logoWidth = 90;
        doc.image(logo, (doc.page.width - logoWidth) / 2, doc.y, { width: logoWidth });
        doc.moveDown(2.5);
      } catch {
        // Not a decodable image (e.g. a .svg logo pdfkit can't render) --
        // fall through to the plain text header below instead of failing
        // the whole PDF over a cosmetic detail.
      }
    }

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000").text(siteName, { align: "center" });
    doc.fontSize(10).font("Helvetica").fillColor("#888").text("Order Receipt", { align: "center" });
    doc.moveDown(1);

    doc.fillColor("#000").fontSize(11).font("Helvetica-Bold").text(`Order ${order.orderNumber}`);
    doc.font("Helvetica").fontSize(9).fillColor("#444");
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString("en-GB")}`);
    if (order.paymentMethod) {
      doc.text(`Payment: ${order.paymentMethod === "mpesa" ? "M-Pesa" : order.paymentMethod === "card" ? "Card" : order.paymentMethod}`);
    }
    if (order.paymentMethod === "mpesa" && order.mpesaReceiptNumber) doc.text(`M-Pesa code: ${order.mpesaReceiptNumber}`);
    if (order.paymentMethod === "card" && order.cardReference) doc.text(`Card reference: ${order.cardReference}`);
    doc.moveDown(0.75);

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000").text("Customer");
    doc.font("Helvetica").fontSize(9).fillColor("#444");
    doc.text(order.email);
    if (order.phone) doc.text(order.phone);
    if (order.shippingAddress) {
      const a = order.shippingAddress;
      doc.text(`${a.firstName} ${a.lastName}`);
      doc.text(a.address1);
      if (a.address2) doc.text(a.address2);
      doc.text(`${a.city}${a.state ? `, ${a.state}` : ""} ${a.postalCode}`);
      doc.text(a.country);
    }
    doc.moveDown(0.75);

    doc.font("Helvetica").fontSize(9).fillColor("#000");
    for (const li of lineItems) {
      doc.text(`${li.productName} × ${li.quantity}`, { continued: true });
      doc.text(`${order.currency} ${li.totalPrice.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });
    }

    doc.moveDown(0.3);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(9);
    doc.text("Subtotal", { continued: true });
    doc.text(`${order.currency} ${order.subtotal.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });
    doc.text("Shipping", { continued: true });
    doc.text(`${order.currency} ${order.shipping.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });
    if (order.tax > 0) {
      doc.text("Tax", { continued: true });
      doc.text(`${order.currency} ${order.tax.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });
    }
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Total", { continued: true });
    doc.text(`${order.currency} ${order.total.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });

    if (refunds && refunds.length > 0) {
      doc.moveDown(1);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ccc").stroke();
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text("Refund history");
      doc.moveDown(0.3);
      for (const r of refunds) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#000").text(`${order.currency} ${r.amount.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { continued: true });
        const statusLabel = r.status === "fulfilled" ? "Fulfilled" : r.status === "cancelled" ? "Cancelled" : "Requested";
        const statusColor = r.status === "fulfilled" ? "#15803d" : r.status === "cancelled" ? "#888" : "#b45309";
        doc.font("Helvetica").fillColor(statusColor).text(`  ${statusLabel}`, { align: "right" });
        doc.font("Helvetica").fontSize(8).fillColor("#444");
        doc.text(r.reason);
        doc.text(`Requested ${new Date(r.createdAt).toLocaleString("en-GB")} by ${r.requestedByEmail}`);
        if (r.status === "fulfilled") {
          doc.text(
            `Sent back${r.fulfilledAt ? ` ${new Date(r.fulfilledAt).toLocaleString("en-GB")}` : ""}${r.fulfilledByEmail ? ` by ${r.fulfilledByEmail}` : ""}${r.fulfillmentReference ? ` — ref ${r.fulfillmentReference}` : ""}`,
          );
          if (r.fulfillmentNote) doc.text(`"${r.fulfillmentNote}"`);
        } else if (r.status === "cancelled") {
          doc.text(
            `Cancelled${r.cancelledAt ? ` ${new Date(r.cancelledAt).toLocaleString("en-GB")}` : ""}${r.cancelledByEmail ? ` by ${r.cancelledByEmail}` : ""}${r.cancellationReason ? ` — ${r.cancellationReason}` : ""}`,
          );
        }
        doc.moveDown(0.5);
      }
    }

    doc.moveDown(1);
    doc.font("Helvetica").fontSize(8).fillColor("#888").text(`Thank you for shopping with ${siteName}.`, { align: "center" });

    doc.end();
  });
}

/**
 * The plain, customer-safe receipt -- order number/date, payment method
 * (never the M-Pesa/card reference), items, totals, thank-you line. No
 * status, no customer block, no refund history: this is the one shape that
 * could ever safely be shown to or sent to a customer (e.g. a future
 * WhatsApp/email "here's your receipt" feature), so it must never carry
 * anything internal-only. The full-detail version lives in
 * buildOrderReceiptPdf above and is for admin eyes only.
 */
export function buildPlainOrderReceiptPdf(
  siteName: string,
  order: Pick<ReceiptOrder, "orderNumber" | "createdAt" | "paymentMethod" | "currency" | "subtotal" | "tax" | "shipping" | "total">,
  lineItems: ReceiptLineItem[],
  logo?: Buffer | null,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (logo) {
      try {
        const logoWidth = 90;
        doc.image(logo, (doc.page.width - logoWidth) / 2, doc.y, { width: logoWidth });
        doc.moveDown(2.5);
      } catch {
        // Logo is cosmetic -- never fail the PDF over it.
      }
    }

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000").text(siteName, { align: "center" });
    doc.fontSize(10).font("Helvetica").fillColor("#888").text("Order Receipt", { align: "center" });
    doc.moveDown(1);

    doc.fillColor("#000").fontSize(11).font("Helvetica-Bold").text(`Order ${order.orderNumber}`);
    doc.font("Helvetica").fontSize(9).fillColor("#444");
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString("en-GB")}`);
    if (order.paymentMethod) {
      doc.text(`Payment: ${order.paymentMethod === "mpesa" ? "M-Pesa" : order.paymentMethod === "card" ? "Card" : order.paymentMethod}`);
    }
    doc.moveDown(0.75);

    doc.font("Helvetica").fontSize(9).fillColor("#000");
    for (const li of lineItems) {
      doc.text(`${li.productName} × ${li.quantity}`, { continued: true });
      doc.text(`${order.currency} ${li.totalPrice.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });
    }

    doc.moveDown(0.3);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(9);
    doc.text("Subtotal", { continued: true });
    doc.text(`${order.currency} ${order.subtotal.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });
    doc.text("Shipping", { continued: true });
    doc.text(`${order.currency} ${order.shipping.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });
    if (order.tax > 0) {
      doc.text("Tax", { continued: true });
      doc.text(`${order.currency} ${order.tax.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });
    }
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Total", { continued: true });
    doc.text(`${order.currency} ${order.total.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`, { align: "right" });

    doc.moveDown(1);
    doc.font("Helvetica").fontSize(8).fillColor("#888").text(`Thank you for shopping with ${siteName}.`, { align: "center" });

    doc.end();
  });
}
