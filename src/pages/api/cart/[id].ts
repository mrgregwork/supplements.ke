import type { APIRoute } from "astro";
import { updateCartItemQuantity, removeFromCart, getCartItems, getCartSessionId, getCartItemById } from "@lib/cart";

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    const body = await request.json();
    const { quantity } = body;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Item ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Verify ownership
    const sessionId = getCartSessionId(request);
    const existingItem = await getCartItemById(id);
    
    if (!existingItem || existingItem.sessionId !== sessionId) {
      return new Response(
        JSON.stringify({ error: "Item not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const item = await updateCartItemQuantity(id, quantity);
    
    // Get updated cart
    let items: any[] = [];
    let total = 0;
    let subtotal = 0;
    
    if (sessionId) {
      items = await getCartItems(sessionId);
      total = items.reduce((sum, item) => sum + item.quantity, 0);
      subtotal = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    }
    
    return new Response(
      JSON.stringify({ success: true, item, items, total, subtotal }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update cart error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update cart" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Item ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Verify ownership
    const sessionId = getCartSessionId(request);
    const existingItem = await getCartItemById(id);
    
    if (!existingItem || existingItem.sessionId !== sessionId) {
      return new Response(
        JSON.stringify({ error: "Item not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    
    await removeFromCart(id);
    
    // Get updated cart
    let items: any[] = [];
    let total = 0;
    let subtotal = 0;
    
    if (sessionId) {
      items = await getCartItems(sessionId);
      total = items.reduce((sum, item) => sum + item.quantity, 0);
      subtotal = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    }
    
    return new Response(
      JSON.stringify({ success: true, items, total, subtotal }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Remove from cart error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to remove item" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
