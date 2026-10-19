// Cash-on-Delivery orders (src/pages/api/cod-order.ts) have no real customer
// email -- only a name, WhatsApp number, and delivery address are collected
// -- so a synthetic placeholder like "cod+0712345678@supplements.ke" is
// stored in the email column just to satisfy the schema's NOT NULL
// constraint. Showing that raw string in the admin UI reads as broken/messy.
// The name the customer actually typed is captured in shippingAddress
// (firstName/lastName) but wasn't being surfaced anywhere in the orders
// list -- this shows that real name instead, with phone as the secondary
// line, matching the clarity of a normal order's email + phone.
const COD_PLACEHOLDER_EMAIL = /^cod\+\d+@/;

export function isCodPlaceholderEmail(email: string): boolean {
  return COD_PLACEHOLDER_EMAIL.test(email);
}

export interface OrderCustomerDisplay {
  primary: string;
  secondary: string | null;
}

export function getOrderCustomerDisplay(order: {
  email: string;
  phone: string | null;
  shippingAddress?: { firstName: string; lastName: string } | null;
}): OrderCustomerDisplay {
  if (isCodPlaceholderEmail(order.email)) {
    const first = order.shippingAddress?.firstName?.trim();
    // cod-order.ts falls back to '-' for a customer who typed a single-word
    // name, so a literal "-" isn't a real last name worth displaying.
    const last = order.shippingAddress?.lastName?.trim();
    const name = first ? [first, last && last !== "-" ? last : null].filter(Boolean).join(" ") : null;

    if (name) {
      return { primary: name, secondary: order.phone || null };
    }
    if (order.phone) {
      return { primary: order.phone, secondary: null };
    }
  }
  return { primary: order.email, secondary: order.phone || null };
}
