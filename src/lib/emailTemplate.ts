// Shared branded shell for every transactional email this store sends
// (login code, order confirmation, ...). Colors match src/styles/global.css's
// live :root exactly (warm cream background, emerald primary, gold accent) --
// supplements.ke has no admin-configurable theme system (unlike cosmetics.ke's
// src/lib/theme.ts), so these are fixed constants, not read from the DB.
// Template structure (shell + itemized order table + payment/receipt line)
// ported from cosmetics.ke's src/lib/emailTemplate.ts.

const BRAND = {
  siteName: "Supplements Kenya",
  colors: {
    background: "40 28% 97%",   // warm cream
    foreground: "20 12% 9%",    // deep warm black
    primary: "151 58% 30%",     // vibrant emerald
    primaryForeground: "0 0% 100%",
    accent: "38 65% 48%",       // rich gold
    accentForeground: "0 0% 100%",
  },
};

function hsl(triplet: string): string {
  return `hsl(${triplet})`;
}

// Minimal escaping for values that ultimately come from admin-editable data
// (product names) before they're interpolated into email HTML.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(bodyHtml: string): string {
  const { siteName, colors } = BRAND;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: ${hsl(colors.background)};">
      <div style="background: ${hsl(colors.primary)}; padding: 20px 24px; text-align: center;">
        <span style="color: ${hsl(colors.primaryForeground)}; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">${escapeHtml(siteName)}</span>
      </div>
      <div style="padding: 32px 24px;">
        ${bodyHtml}
      </div>
      <div style="padding: 16px 24px; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">This is an automated message from ${escapeHtml(siteName)}.</p>
      </div>
    </div>
  `;
}

export function renderOtpEmailHtml(code: string): string {
  const { colors } = BRAND;
  const body = `
    <p style="color: ${hsl(colors.foreground)}; font-size: 15px; text-align: center; margin: 0 0 8px;">Your one-time login code is:</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="display: inline-block; letter-spacing: 8px; font-size: 32px; font-weight: bold; font-family: monospace; color: ${hsl(colors.accent)}; background: ${hsl(colors.background)}; padding: 14px 20px; border-radius: 8px; border: 2px solid ${hsl(colors.accent)};">${escapeHtml(code)}</span>
    </div>
    <p style="color: #888; font-size: 13px; text-align: center; margin: 0;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
    <p style="color: #999; font-size: 12px; text-align: center; margin: 16px 0 0;">If you did not request this code, you can safely ignore this email.</p>
  `;
  return shell(body);
}

export interface OrderConfirmationItem {
  productName: string;
  quantity: number;
  totalPrice: number;
}

export interface OrderConfirmationData {
  orderNumber: string;
  currency: string;
  total: number;
  items: OrderConfirmationItem[];
  paymentMethod: string | null;
  mpesaReceiptNumber: string | null;
  cardReference: string | null;
}

function paymentMethodLabel(method: string | null): string | null {
  if (method === "mpesa") return "M-Pesa";
  if (method === "card") return "Card";
  if (method === "cod") return "Cash on Delivery";
  return method;
}

function itemRows(items: OrderConfirmationItem[], currency: string): string {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding: 6px 0; color: #333; font-size: 14px;">${escapeHtml(item.productName)} &times; ${item.quantity}</td>
          <td style="padding: 6px 0; color: #333; font-size: 14px; text-align: right;">${escapeHtml(currency)} ${item.totalPrice.toLocaleString()}</td>
        </tr>`,
    )
    .join("");
}

export function renderOrderConfirmationEmailHtml(order: OrderConfirmationData): string {
  const { colors } = BRAND;
  const methodLabel = paymentMethodLabel(order.paymentMethod);
  const receiptLine = order.mpesaReceiptNumber
    ? `M-Pesa Receipt: <strong>${escapeHtml(order.mpesaReceiptNumber)}</strong>`
    : order.cardReference
      ? `Reference: <strong>${escapeHtml(order.cardReference)}</strong>`
      : null;

  const body = `
    <div style="text-align: center; margin-bottom: 16px;">
      <span style="display: inline-block; color: #1a7f37; background: #e9f7ef; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">&#10003; Payment received</span>
    </div>
    <p style="color: ${hsl(colors.foreground)}; font-size: 15px; text-align: center; margin-bottom: 24px;">
      Thank you! Order <strong>${escapeHtml(order.orderNumber)}</strong> is confirmed.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      ${itemRows(order.items, order.currency)}
    </table>
    <div style="border-top: 2px solid ${hsl(colors.primary)}; padding-top: 8px; display: flex; justify-content: space-between; font-weight: bold; color: ${hsl(colors.primary)};">
      <span>Total</span>
      <span>${escapeHtml(order.currency)} ${order.total.toLocaleString()}</span>
    </div>
    ${methodLabel ? `<p style="color: #666; font-size: 13px; margin-top: 20px;">Paid via ${escapeHtml(methodLabel)}${receiptLine ? `<br>${receiptLine}` : ""}</p>` : ""}
  `;
  return shell(body);
}
