// Short human-readable summary of what an order contains, sent to the payment
// gateway as the transaction description (shown in E-Payments' dashboard and
// its "Payment received" email) instead of a fixed phrase.
//
// The cap matters: E-Payments passes this straight through to Safaricom's
// Daraja `TransactionDesc` with no truncation of its own, and Daraja documents
// a very short limit for that field. 23 characters is the length of the old
// fixed "Supplements Kenya order" text, i.e. the only length proven to work in
// production here (live KES 1 / KES 5 tests, 30/09/2026), so it is the
// default until a live test shows a longer value is accepted. The full item
// list is also sent in `metadata` (no length risk there), so nothing is lost
// by the short description. Same helper as cosmetics.ke's.
export const GATEWAY_DESCRIPTION_MAX = 23;

export interface DescribableItem {
  productName: string;
  quantity: number;
}

export function buildOrderDescription(items: DescribableItem[], max = GATEWAY_DESCRIPTION_MAX): string {
  const first = items[0];
  if (!first) return "Order";

  const extra = items.length - 1;
  const tail = `${first.quantity > 1 ? ` x${first.quantity}` : ""}${extra > 0 ? ` +${extra}` : ""}`;
  // ASCII only -- the description ends up in an M-Pesa SMS and a gateway email.
  const cleanName = first.productName.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
  const name = cleanName.slice(0, Math.max(max - tail.length, 4)).trim();
  return `${name}${tail}`.slice(0, max) || "Order";
}
