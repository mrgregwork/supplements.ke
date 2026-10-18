/**
 * POST /api/cod-order
 * Creates a Cash-on-Delivery order from the checkout modal.
 */
import type { APIRoute } from 'astro';
import { db } from '../../../server/db';
import { orders, orderItems, products } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { sendOrderNotificationEmail } from '../../../server/email';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { productId, quantity, name, phone, whatsapp, address, city, unitPrice, currency } = body;

    // Basic validation
    if (!productId || !quantity || !name || !phone || !address || !city) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch product to verify price
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cur = currency || product.currency || 'KES';
    const qty = Math.max(1, Math.min(10, parseInt(quantity)));
    const subtotal = parseFloat(unitPrice) * qty;
    const shipping = 0; // Free delivery
    const total = subtotal + shipping;

    // Generate order number: SK-YYYYMMDD-XXXX
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `SK-${today}-${rand}`;

    // Parse name into first/last
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] ?? name;
    const lastName = nameParts.slice(1).join(' ') || '-';

    const shippingAddress = {
      firstName,
      lastName,
      address1: address,
      city,
      postalCode: '',
      country: 'Kenya',
    };

    // Create order
    const [order] = await db.insert(orders).values({
      orderNumber,
      email: `cod+${phone.replace(/\D/g, '')}@supplements.ke`, // placeholder email for COD
      phone,
      status: 'pending',
      paymentMethod: 'cod',
      subtotal,
      tax: 0,
      shipping,
      total,
      currency: cur,
      shippingAddress,
      notes: whatsapp ? `WhatsApp: ${whatsapp}` : undefined,
    }).returning();

    // Create order item
    await db.insert(orderItems).values({
      orderId: order.id,
      productId: product.id,
      productName: product.name,
      productImage: Array.isArray(product.images) ? (product.images[0] as string | undefined) ?? null : null,
      quantity: qty,
      unitPrice: parseFloat(unitPrice),
      totalPrice: subtotal,
    });

    // Best-effort -- a COD order has no real customer email to send a
    // receipt to, but sales still needs to see it to arrange delivery.
    sendOrderNotificationEmail({
      orderNumber: order.orderNumber,
      currency: cur,
      total,
      items: [{ productName: product.name, quantity: qty, totalPrice: subtotal }],
      paymentMethod: 'cod',
      paymentStatus: 'awaiting_payment',
      mpesaReceiptNumber: null,
      cardReference: null,
      customerEmail: order.email,
      customerPhone: phone,
      shippingAddress,
      notes: whatsapp ? `WhatsApp: ${whatsapp}` : null,
    }).catch(() => {
      // Deliberately swallowed -- an unconfigured/failing Resend send must
      // never fail order placement.
    });

    return new Response(JSON.stringify({
      success: true,
      orderNumber: order.orderNumber,
      total,
      currency: cur,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('COD order error:', err);
    return new Response(JSON.stringify({ error: 'Failed to place order' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
