import PDFDocument from "pdfkit";

// Same approach as shopusa.co.ke's shared/receiptPdf.ts (returns a Buffer so
// Astro's Response can stream it, since Express and Astro consume PDFKit
// output differently) -- including its table-column and row() layout
// techniques, ported here after the original version of this file (plain
// doc.text() calls with { continued: true }) looked "plainly deconstructed"
// next to ShopUSA's own receipt.
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

function money(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

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

    // Draws a label (left) and a value (right, right-aligned) on the same
    // row, measuring real text height instead of guessing. Plain PDFKit
    // `{ continued: true }` text can't do this cleanly: once that call
    // finishes, PDFKit's cursor is left narrowed to whatever sliver of width
    // the right-hand text used, so any later plain doc.text(str) call with
    // no coordinates of its own silently wraps inside that same narrow
    // column instead of the full page width (this is what made the old
    // version of this file look "scribbled on").
    function row(left: string, right: string, opts?: { bold?: boolean; color?: string }) {
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica").fillColor(opts?.color ?? "#000");
      const rightWidth = Math.max(doc.widthOfString(right) + 2, 56);
      const leftWidth = contentWidth - rightWidth - 8;
      const startY = doc.y;
      const leftHeight = doc.heightOfString(left, { width: leftWidth });
      doc.text(left, doc.page.margins.left, startY, { width: leftWidth });
      doc.text(right, doc.page.margins.left + leftWidth + 8, startY, { width: rightWidth, align: "right" });
      doc.y = startY + leftHeight;
      doc.x = doc.page.margins.left;
    }

    if (logo) {
      try {
        const logoWidth = 56;
        doc.image(logo, (doc.page.width - logoWidth) / 2, doc.y, { width: logoWidth });
        doc.moveDown(3.5);
      } catch {
        // Not a decodable image (e.g. a .svg logo pdfkit can't render) --
        // fall through to the plain text header below instead of failing
        // the whole PDF over a cosmetic detail.
      }
    }

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000").text(siteName, { align: "center" });
    doc.fontSize(10).font("Helvetica").fillColor("#888").text("Receipt", { align: "center" });
    doc.moveDown(1);

    doc.fillColor("#000").fontSize(11).font("Helvetica-Bold").text(`Order #${order.orderNumber}`);
    doc.font("Helvetica").fontSize(9).fillColor("#444");
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString("en-GB")}`);
    if (order.paymentMethod) {
      doc.text(`Payment: ${order.paymentMethod === "mpesa" ? "M-Pesa" : order.paymentMethod === "card" ? "Card" : order.paymentMethod}`);
    }
    if (order.paymentMethod === "mpesa" && order.mpesaReceiptNumber) doc.text(`M-Pesa code: ${order.mpesaReceiptNumber}`);
    if (order.paymentMethod === "card" && order.cardReference) doc.text(`Card reference: ${order.cardReference}`);

    doc.moveDown(0.6);
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

    // A real, hand-positioned table (Item | Qty | Price | Total) -- pdfkit
    // has no built-in table support, same approach shopusa.co.ke's own
    // shared/receiptPdf.ts uses for its column-aligned receipt.
    const tableContentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colQtyWidth = 32;
    const colPriceWidth = 72;
    const colTotalWidth = 72;
    const colItemWidth = tableContentWidth - colQtyWidth - colPriceWidth - colTotalWidth;
    const itemX = doc.page.margins.left;
    const qtyX = itemX + colItemWidth;
    const priceX = qtyX + colQtyWidth;
    const totalX = priceX + colPriceWidth;

    function drawTableHeader() {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#555");
      doc.text("Item", itemX, y, { width: colItemWidth });
      doc.text("Qty", qtyX, y, { width: colQtyWidth, align: "right" });
      doc.text("Price", priceX, y, { width: colPriceWidth, align: "right" });
      doc.text("Total", totalX, y, { width: colTotalWidth, align: "right" });
      doc.y = y + 11;
      doc.x = itemX;
      doc.moveTo(itemX, doc.y).lineTo(itemX + tableContentWidth, doc.y).lineWidth(0.75).strokeColor("#999").stroke();
      doc.moveDown(0.35);
      doc.x = itemX;
    }

    drawTableHeader();

    for (const li of lineItems) {
      doc.font("Helvetica").fontSize(9);
      const titleHeight = doc.heightOfString(li.productName, { width: colItemWidth });
      const rowHeight = Math.max(titleHeight, 12);

      // Re-draws the header on a fresh page so a multi-item order that
      // spans pages never shows a page of bare numbers with no column
      // labels.
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        drawTableHeader();
      }

      const startY = doc.y;
      doc.fillColor("#000").font("Helvetica").fontSize(9);
      doc.text(li.productName, itemX, startY, { width: colItemWidth });
      doc.text(String(li.quantity), qtyX, startY, { width: colQtyWidth, align: "right" });
      doc.text(money(order.currency, li.unitPrice), priceX, startY, { width: colPriceWidth, align: "right" });
      doc.font("Helvetica-Bold").text(money(order.currency, li.totalPrice), totalX, startY, { width: colTotalWidth, align: "right" });

      doc.y = startY + rowHeight;
      doc.x = itemX;
      doc.moveDown(0.3);
      doc.moveTo(itemX, doc.y).lineTo(itemX + tableContentWidth, doc.y).lineWidth(0.5).strokeColor("#eee").stroke();
      doc.moveDown(0.3);
      doc.x = itemX;
    }

    doc.moveDown(0.1);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(0.3);

    doc.fontSize(9);
    row("Subtotal", money(order.currency, order.subtotal));
    row("Delivery", money(order.currency, order.shipping));
    if (order.tax > 0) {
      row("Tax", money(order.currency, order.tax));
    }
    doc.fontSize(10);
    row("Total", money(order.currency, order.total), { bold: true });

    if (refunds && refunds.length > 0) {
      doc.moveDown(1);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ccc").stroke();
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text("Refund history");
      doc.moveDown(0.3);
      for (const r of refunds) {
        const statusLabel = r.status === "fulfilled" ? "Fulfilled" : r.status === "cancelled" ? "Cancelled" : "Requested";
        const statusColor = r.status === "fulfilled" ? "#15803d" : r.status === "cancelled" ? "#888" : "#b45309";
        row(statusLabel, money(order.currency, r.amount), { bold: true, color: statusColor });
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

    function row(left: string, right: string, opts?: { bold?: boolean; color?: string }) {
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica").fillColor(opts?.color ?? "#000");
      const rightWidth = Math.max(doc.widthOfString(right) + 2, 56);
      const leftWidth = contentWidth - rightWidth - 8;
      const startY = doc.y;
      const leftHeight = doc.heightOfString(left, { width: leftWidth });
      doc.text(left, doc.page.margins.left, startY, { width: leftWidth });
      doc.text(right, doc.page.margins.left + leftWidth + 8, startY, { width: rightWidth, align: "right" });
      doc.y = startY + leftHeight;
      doc.x = doc.page.margins.left;
    }

    if (logo) {
      try {
        const logoWidth = 56;
        doc.image(logo, (doc.page.width - logoWidth) / 2, doc.y, { width: logoWidth });
        doc.moveDown(3.5);
      } catch {
        // Logo is cosmetic -- never fail the PDF over it.
      }
    }

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000").text(siteName, { align: "center" });
    doc.fontSize(10).font("Helvetica").fillColor("#888").text("Receipt", { align: "center" });
    doc.moveDown(1);

    doc.fillColor("#000").fontSize(11).font("Helvetica-Bold").text(`Order #${order.orderNumber}`);
    doc.font("Helvetica").fontSize(9).fillColor("#444");
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString("en-GB")}`);
    if (order.paymentMethod) {
      doc.text(`Payment: ${order.paymentMethod === "mpesa" ? "M-Pesa" : order.paymentMethod === "card" ? "Card" : order.paymentMethod}`);
    }
    doc.moveDown(0.75);

    const tableContentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colQtyWidth = 32;
    const colPriceWidth = 72;
    const colTotalWidth = 72;
    const colItemWidth = tableContentWidth - colQtyWidth - colPriceWidth - colTotalWidth;
    const itemX = doc.page.margins.left;
    const qtyX = itemX + colItemWidth;
    const priceX = qtyX + colQtyWidth;
    const totalX = priceX + colPriceWidth;

    function drawTableHeader() {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#555");
      doc.text("Item", itemX, y, { width: colItemWidth });
      doc.text("Qty", qtyX, y, { width: colQtyWidth, align: "right" });
      doc.text("Price", priceX, y, { width: colPriceWidth, align: "right" });
      doc.text("Total", totalX, y, { width: colTotalWidth, align: "right" });
      doc.y = y + 11;
      doc.x = itemX;
      doc.moveTo(itemX, doc.y).lineTo(itemX + tableContentWidth, doc.y).lineWidth(0.75).strokeColor("#999").stroke();
      doc.moveDown(0.35);
      doc.x = itemX;
    }

    drawTableHeader();

    for (const li of lineItems) {
      doc.font("Helvetica").fontSize(9);
      const titleHeight = doc.heightOfString(li.productName, { width: colItemWidth });
      const rowHeight = Math.max(titleHeight, 12);

      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        drawTableHeader();
      }

      const startY = doc.y;
      doc.fillColor("#000").font("Helvetica").fontSize(9);
      doc.text(li.productName, itemX, startY, { width: colItemWidth });
      doc.text(String(li.quantity), qtyX, startY, { width: colQtyWidth, align: "right" });
      doc.text(money(order.currency, li.unitPrice), priceX, startY, { width: colPriceWidth, align: "right" });
      doc.font("Helvetica-Bold").text(money(order.currency, li.totalPrice), totalX, startY, { width: colTotalWidth, align: "right" });

      doc.y = startY + rowHeight;
      doc.x = itemX;
      doc.moveDown(0.3);
      doc.moveTo(itemX, doc.y).lineTo(itemX + tableContentWidth, doc.y).lineWidth(0.5).strokeColor("#eee").stroke();
      doc.moveDown(0.3);
      doc.x = itemX;
    }

    doc.moveDown(0.1);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(0.3);

    doc.fontSize(9);
    row("Subtotal", money(order.currency, order.subtotal));
    row("Delivery", money(order.currency, order.shipping));
    if (order.tax > 0) {
      row("Tax", money(order.currency, order.tax));
    }
    doc.fontSize(10);
    row("Total", money(order.currency, order.total), { bold: true });

    doc.moveDown(1);
    doc.font("Helvetica").fontSize(8).fillColor("#888").text(`Thank you for shopping with ${siteName}.`, { align: "center" });

    doc.end();
  });
}
