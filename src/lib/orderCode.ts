// Short, human-readable order code -- reserved the moment checkout starts
// (see checkout/init.ts) rather than only generated once an order is
// actually confirmed, so it can double as the M-Pesa/Card gateway's
// accountReference. Reusing the exact same code as the final order number
// (see checkoutFinalize.ts) means whatever a customer sees in their M-Pesa
// confirmation SMS always matches their order confirmation -- see
// docs/PAYMENT_INTEGRATION.md for the bug this fixes (the account
// reference was previously the raw pending_orders UUID).
//
// Capped at 12 characters -- E-Payments' own API docs state accountReference
// is "max 12 chars, shown in M-Pesa" (confirmed reading D:\Projects\E-Payments
// src/app/docs/page.js, read-only reference per this project's own rule
// against editing that codebase). No prefix/separator, unlike an ordinary
// order number, since there's no room left for one within 12 characters
// once enough of the timestamp is kept for real-world uniqueness.
export function generateOrderCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${timestamp}${random}`.slice(-12);
}
