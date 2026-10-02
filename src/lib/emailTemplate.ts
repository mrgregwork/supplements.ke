// Shared branded shell for every transactional email this store sends
// (login code, order confirmation, ...). Colors match src/styles/global.css's
// live :root exactly (warm cream background, emerald primary, gold accent) --
// supplements.ke has no admin-configurable theme system (unlike cosmetics.ke's
// src/lib/theme.ts), so these are fixed constants, not read from the DB.
// Template structure ported from cosmetics.ke's src/lib/emailTemplate.ts,
// including its Gmail dark-mode fix. See docs/PAYMENT_INTEGRATION.md
// ("Transactional emails").
//
// Two renderings of each color are needed here: an hsl(...) string for modern
// mail clients that honour CSS, and a hex equivalent for the `bgcolor`
// HTML attribute -- several widely-used clients (Outlook desktop, some
// Gmail dark-mode paths) ignore inline `background-color` on anything but
// a handful of elements and need the legacy attribute as a fallback. The
// BRAND triplets are the single source of truth; the hex values are derived
// from them, never typed by hand, so the two can't drift apart.
//
// Do NOT go back to a fragment of bare <div>s (or flexbox rows) with no
// surrounding <html>/<head> and no color-scheme declaration. Gmail's dark
// mode treats undeclared HTML as "not dark-mode aware" and aggressively
// repaints it -- stripping custom background colors and flattening text to
// near-white, a washed-out, colourless result. The
// <meta name="color-scheme"/"supported-color-schemes" content="light only">
// pair below is the standard fix: it tells every major client this email
// manages its own palette and must be left alone. Layout is <table>-based
// (not flex) because several mobile mail apps ignore display:flex and
// collapse a flex row, e.g. the "Total" line, into one jammed-together run.

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

function withLightness(triplet: string, lightness: number): string {
  const match = triplet.match(/(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!match) return triplet;
  const [, h, s] = match;
  return `${h} ${s}% ${lightness}%`;
}

function hslToHex(triplet: string): string {
  const match = triplet.match(/(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!match) return "#000000";
  const h = Number(match[1]);
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

const FONT = "Arial, Helvetica, sans-serif";

function shell(bodyHtml: string): string {
  const { siteName, colors } = BRAND;

  const primaryHex = hslToHex(colors.primary);
  const primaryForegroundHex = hslToHex(colors.primaryForeground);
  const accentHex = hslToHex(colors.accent);
  const backgroundHex = hslToHex(colors.background);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(siteName)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f1f3;" bgcolor="#f1f1f3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f1f3;" bgcolor="#f1f1f3">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; border-radius:12px; overflow:hidden; border:1px solid #e5e5e9; background-color:${backgroundHex};" bgcolor="${backgroundHex}">
<tr>
<td style="background-color:${primaryHex}; padding:22px 24px 18px; text-align:center;" bgcolor="${primaryHex}">
<span style="color:${primaryForegroundHex}; font-family:${FONT}; font-size:19px; font-weight:bold; letter-spacing:0.5px;">${escapeHtml(siteName)}</span>
</td>
</tr>
<tr>
<td style="height:4px; line-height:4px; font-size:0; background-color:${accentHex};" bgcolor="${accentHex}">&nbsp;</td>
</tr>
<tr>
<td style="padding:32px 28px;">
${bodyHtml}
</td>
</tr>
<tr>
<td style="padding:16px 28px; border-top:1px solid #ededf1;">
<p style="margin:0; color:#9a9aa3; font-size:12px; text-align:center; font-family:${FONT};">This is an automated message from ${escapeHtml(siteName)}. Please do not reply to this email.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export function renderOtpEmailHtml(code: string): string {
  const { colors } = BRAND;
  const foregroundHex = hslToHex(colors.foreground);
  const accentHex = hslToHex(colors.accent);
  const accentTintHex = hslToHex(withLightness(colors.accent, 95));

  const body = `
<p style="margin:0 0 4px; color:${foregroundHex}; font-size:15px; text-align:center; font-family:${FONT};">Here is your verification code</p>
<p style="margin:0 0 28px; color:#9a9aa3; font-size:13px; text-align:center; font-family:${FONT};">Use this to finish signing in</p>
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr>
<td style="background-color:${accentTintHex}; border:1.5px solid ${accentHex}; border-radius:10px; padding:16px 28px; text-align:center;" bgcolor="${accentTintHex}">
<span style="font-family:'Courier New',Courier,monospace; font-size:32px; font-weight:bold; letter-spacing:10px; color:${accentHex};">${escapeHtml(code)}</span>
</td>
</tr>
</table>
<p style="margin:0; color:#9a9aa3; font-size:13px; text-align:center; font-family:${FONT};">This code expires in <strong style="color:${foregroundHex};">10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>`;

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

function itemRows(items: OrderConfirmationItem[], currency: string, foregroundHex: string): string {
  return items
    .map(
      (item, i) => `
<tr>
<td style="padding:10px 0; border-top:${i === 0 ? "none" : "1px solid #ededf1"}; color:${foregroundHex}; font-size:14px; font-family:${FONT};">${escapeHtml(item.productName)} &times; ${item.quantity}</td>
<td style="padding:10px 0; border-top:${i === 0 ? "none" : "1px solid #ededf1"}; color:${foregroundHex}; font-size:14px; font-family:${FONT}; text-align:right; white-space:nowrap;">${escapeHtml(currency)} ${item.totalPrice.toLocaleString()}</td>
</tr>`,
    )
    .join("");
}

export function renderOrderConfirmationEmailHtml(order: OrderConfirmationData): string {
  const { colors } = BRAND;
  const foregroundHex = hslToHex(colors.foreground);
  const primaryHex = hslToHex(colors.primary);
  const accentTintHex = hslToHex(withLightness(colors.accent, 95));

  const methodLabel = paymentMethodLabel(order.paymentMethod);
  const receiptLine = order.mpesaReceiptNumber
    ? `M-Pesa Receipt: <strong style="color:${foregroundHex};">${escapeHtml(order.mpesaReceiptNumber)}</strong>`
    : order.cardReference
      ? `Reference: <strong style="color:${foregroundHex};">${escapeHtml(order.cardReference)}</strong>`
      : null;

  const body = `
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
<tr>
<td style="background-color:#e9f7ef; border-radius:20px; padding:8px 18px;" bgcolor="#e9f7ef">
<span style="color:#1a7f37; font-size:14px; font-weight:bold; font-family:${FONT};">&#10003; Payment received</span>
</td>
</tr>
</table>
<p style="margin:0 0 24px; color:${foregroundHex}; font-size:15px; text-align:center; font-family:${FONT};">Thank you! Order <strong>${escapeHtml(order.orderNumber)}</strong> is confirmed.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
${itemRows(order.items, order.currency, foregroundHex)}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${accentTintHex}; border-radius:8px;" bgcolor="${accentTintHex}">
<tr>
<td style="padding:14px 16px; color:${primaryHex}; font-size:15px; font-weight:bold; font-family:${FONT};">Total</td>
<td style="padding:14px 16px; color:${primaryHex}; font-size:15px; font-weight:bold; font-family:${FONT}; text-align:right;">${escapeHtml(order.currency)} ${order.total.toLocaleString()}</td>
</tr>
</table>
${methodLabel ? `<p style="margin:20px 0 0; color:#6f6f78; font-size:13px; text-align:center; font-family:${FONT};">Paid via ${escapeHtml(methodLabel)}${receiptLine ? `<br>${receiptLine}` : ""}</p>` : ""}`;

  return shell(body);
}
