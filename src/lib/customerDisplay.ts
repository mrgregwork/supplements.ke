// Cash-on-Delivery orders (src/pages/api/cod-order.ts) have no real customer
// email -- only a phone number is collected -- so a synthetic placeholder
// like "cod+0712345678@supplements.ke" is stored in the email column just to
// satisfy the schema's NOT NULL constraint. Showing that raw string in the
// admin UI reads as broken/messy and duplicates the phone number shown right
// next to it. This renders the one real piece of contact info instead.
const COD_PLACEHOLDER_EMAIL = /^cod\+\d+@/;

export function isCodPlaceholderEmail(email: string): boolean {
  return COD_PLACEHOLDER_EMAIL.test(email);
}

export interface OrderCustomerDisplay {
  primary: string;
  secondary: string | null;
}

export function getOrderCustomerDisplay(order: { email: string; phone: string | null }): OrderCustomerDisplay {
  if (isCodPlaceholderEmail(order.email) && order.phone) {
    return { primary: order.phone, secondary: null };
  }
  return { primary: order.email, secondary: order.phone || null };
}
