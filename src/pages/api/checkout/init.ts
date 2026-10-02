import type { APIRoute } from "astro";
import { db } from "../../../../server/db";
import { customers, pendingOrders } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCartSessionId, getCartItems, clearCart } from "@lib/cart";
import { initiateMpesaStkPush, initiatePaystackCharge } from "@lib/epayments";
import { generateOrderCode } from "@lib/orderCode";
import { buildOrderDescription } from "@lib/orderDescription";
import siteSettings from "@config/siteSettings.json";

// Real checkout entry point -- replaces the "Demo Mode" flow in the old
// api/checkout.ts (kept in place, unused by the UI, per this repo's rule
// against removing existing routes). Re-prices everything server-side from
// the cart session (never a client-supplied amount), stages a
// pending_orders row, then hands off to E-Payments for either an M-Pesa
// STK push or a Paystack hosted charge. Confirmation happens later via
// webhook/poll/cron -> finalizePendingOrder, never here. See
// docs/PAYMENT_INTEGRATION.md.

export const prerender = false;

const shippingAddressSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  address1: z.string().min(1, "Address is required"),
  address2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
});

const initSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  shippingAddress: shippingAddressSchema,
  notes: z.string().optional(),
  customerId: z.string().nullable().optional(),
  paymentMethod: z.enum(["mpesa", "card"]),
});

/** Kenyan numbers only, in the 2547XXXXXXXX / 2541XXXXXXXX shape Safaricom/E-Payments expect. */
function normalizeKenyanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

/** Never derive this from request.url -- on Railway that's an internal proxy address the outside world can't reach. */
function getPublicOrigin(): string {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : siteSettings.siteUrl;
}

/**
 * customers.email and customers.phone both carry a unique DB constraint
 * (phone is also used to look a customer up at OTP login), but guest
 * checkout must always create a fresh row rather than being silently
 * matched against an existing customer by either field (see the note at
 * the call site). A collision here just means this contact info already
 * belongs to another customer record -- drop whichever field collided and
 * retry, rather than failing the whole checkout. The order itself still
 * carries the real email/phone regardless of what this guest row ends up
 * with; NULL is never itself a unique-constraint collision, so this always
 * terminates.
 */
async function insertGuestCustomer(email: string, phone: string | null) {
  let attemptEmail: string | null = email;
  let attemptPhone: string | null = phone;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [guest] = await db.insert(customers).values({ email: attemptEmail, phone: attemptPhone }).returning();
      return guest;
    } catch (err: any) {
      if (err?.code !== "23505") throw err;
      // Matched by substring, not an exact constraint name -- this
      // database's constraints happen to be Postgres's own default
      // `<table>_<column>_key` naming, but cosmetics.ke's identical schema
      // turned out to use Drizzle's `<table>_<column>_unique` naming
      // instead (depends on how each database's schema was originally
      // created), so an exact match there never fired. Substring matching
      // survives either naming convention.
      if (err.constraint?.includes("email") && attemptEmail !== null) {
        attemptEmail = null;
        continue;
      }
      if (err.constraint?.includes("phone") && attemptPhone !== null) {
        attemptPhone = null;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not create guest customer record");
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const parseResult = initSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => e.message).join(", ");
      return new Response(JSON.stringify({ error: errors }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { email, phone, shippingAddress, notes, customerId, paymentMethod } = parseResult.data;

    if (paymentMethod === "mpesa" && !phone) {
      return new Response(JSON.stringify({ error: "Phone number is required for M-Pesa" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    let normalizedPhone: string | null = null;
    if (paymentMethod === "mpesa") {
      normalizedPhone = normalizeKenyanPhone(phone!);
      if (!normalizedPhone) {
        return new Response(JSON.stringify({ error: "Enter a valid Kenyan phone number (e.g. 07XXXXXXXX)" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    const sessionId = getCartSessionId(request);
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "No cart session found" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Re-derive everything from the server-side cart -- the client never
    // supplies a price or total.
    const cartItems = await getCartItems(sessionId);
    if (cartItems.length === 0) {
      return new Response(JSON.stringify({ error: "Cart is empty" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const tax = 0;
    const shipping = 0;
    const total = subtotal + tax + shipping;

    // A typed email is never matched against an existing customer to
    // silently authenticate them -- a guest checkout always gets a fresh
    // customer row.
    let resolvedCustomerId: string | null = customerId ?? null;
    if (!resolvedCustomerId) {
      const guest = await insertGuestCustomer(email, normalizedPhone ?? phone ?? null);
      resolvedCustomerId = guest.id;
    }

    const itemsSnapshot = cartItems.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      productImage: item.product.images[0] ?? null,
      quantity: item.quantity,
      unitPrice: item.product.price,
      totalPrice: item.product.price * item.quantity,
    }));

    const orderCode = generateOrderCode();
    const description = buildOrderDescription(itemsSnapshot);
    const gatewayMetadata = {
      orderCode,
      items: itemsSnapshot.map((i) => ({ name: i.productName, qty: i.quantity, total: i.totalPrice })),
    };

    const [pending] = await db
      .insert(pendingOrders)
      .values({
        orderCode,
        customerId: resolvedCustomerId,
        email,
        phone: normalizedPhone ?? phone ?? null,
        shippingAddress,
        notes: notes ?? null,
        items: itemsSnapshot,
        subtotal,
        tax,
        shipping,
        total,
        currency: "KES",
        paymentMethod,
        status: "pending",
      })
      .returning();

    const origin = getPublicOrigin();

    try {
      if (paymentMethod === "mpesa") {
        const result = await initiateMpesaStkPush({
          phoneNumber: normalizedPhone!,
          amount: Math.round(total),
          accountReference: orderCode,
          description,
          metadata: { ...gatewayMetadata, pendingOrderId: pending.id },
        });

        await db.update(pendingOrders).set({ gatewayTransactionId: result.transactionId }).where(eq(pendingOrders.id, pending.id));

        await clearCart(sessionId);

        return new Response(
          JSON.stringify({ success: true, pendingOrderId: pending.id, provider: "mpesa", checkoutRequestId: result.checkoutRequestId }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      } else {
        const result = await initiatePaystackCharge({
          email,
          amount: Math.round(total),
          accountReference: orderCode,
          description,
          redirectUrl: `${origin}/checkout/return?pendingOrderId=${pending.id}`,
          metadata: { ...gatewayMetadata, pendingOrderId: pending.id },
        });

        await db.update(pendingOrders).set({ gatewayTransactionId: result.transactionId }).where(eq(pendingOrders.id, pending.id));

        await clearCart(sessionId);

        return new Response(
          JSON.stringify({ success: true, pendingOrderId: pending.id, provider: "card", checkoutUrl: result.checkoutUrl }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    } catch (gatewayError) {
      // The gateway call itself failed to even start -- mark the pending
      // order failed immediately rather than leaving it stuck "pending"
      // with nothing ever going to try to resolve it (no transaction
      // reference exists yet for the reconciliation cron to poll).
      await db.update(pendingOrders).set({
        status: "failed",
        gatewayMessage: gatewayError instanceof Error ? gatewayError.message : "Failed to reach payment gateway",
      }).where(eq(pendingOrders.id, pending.id));

      return new Response(JSON.stringify({ error: "Could not start the payment. Please try again." }), { status: 502, headers: { "Content-Type": "application/json" } });
    }
  } catch (error) {
    console.error("Checkout init error:", error);
    return new Response(JSON.stringify({ error: "Failed to start checkout" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
