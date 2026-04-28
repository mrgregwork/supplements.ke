import type { APIRoute } from "astro";
import { getCartItems, addToCart, generateCartSessionId, getCartSessionId } from "@lib/cart";

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const sessionId = getCartSessionId(request);
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ items: [], total: 0, subtotal: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const items = await getCartItems(sessionId);
    const subtotal = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    
    return new Response(
      JSON.stringify({ items, total, subtotal }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get cart error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get cart" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { productId, quantity = 1 } = body;
    
    if (!productId) {
      return new Response(
        JSON.stringify({ error: "Product ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get or create cart session
    let sessionId = getCartSessionId(request);
    
    if (!sessionId) {
      sessionId = generateCartSessionId();
      cookies.set("cartSession", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: "/",
      });
    }
    
    const item = await addToCart(sessionId, productId, quantity);
    
    // Get updated cart count
    const items = await getCartItems(sessionId);
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    
    return new Response(
      JSON.stringify({ success: true, item, cartTotal: total }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Add to cart error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to add item to cart" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
