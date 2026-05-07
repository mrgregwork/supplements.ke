import type { APIRoute } from "astro";
import { db } from "../../../server/db";
import { orders, orderItems, cartItems, products } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getCartSessionId, getCartItems, clearCart } from "@lib/cart";
import { z } from "zod";

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

const checkoutSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  shippingAddress: shippingAddressSchema,
  notes: z.string().optional(),
  customerId: z.string().nullable().optional(),
});

function generateOrderNumber(): string {
  const prefix = "ORD";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    
    const parseResult = checkoutSchema.safeParse(body);
    
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => e.message).join(", ");
      return new Response(
        JSON.stringify({ error: errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const { email, phone, shippingAddress, notes, customerId } = parseResult.data;
    
    const sessionId = getCartSessionId(request);
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "No cart session found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const items = await getCartItems(sessionId);
    
    if (items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Cart is empty" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const subtotal = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const tax = 0;
    const shipping = 0;
    const total = subtotal + tax + shipping;
    
    const orderNumber = generateOrderNumber();
    
    const [order] = await db
      .insert(orders)
      .values({
        orderNumber,
        customerId: customerId || null,
        email,
        phone: phone || null,
        status: "confirmed",
        subtotal,
        tax,
        shipping,
        total,
        currency: "KES",
        shippingAddress,
        notes: notes || null,
      })
      .returning();
    
    for (const item of items) {
      await db.insert(orderItems).values({
        orderId: order.id,
        productId: item.product.id,
        productName: item.product.name,
        productImage: item.product.images[0] || null,
        quantity: item.quantity,
        unitPrice: item.product.price,
        totalPrice: item.product.price * item.quantity,
      });
    }
    
    await clearCart(sessionId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId: order.id,
        orderNumber: order.orderNumber,
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process checkout" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
