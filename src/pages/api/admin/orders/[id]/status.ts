import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession, updateOrderStatus } from "@lib/admin";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
});

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    
    if (!import.meta.env.DEV && !sessionData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const { id } = params;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Order ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const body = await request.json();
    const parseResult = statusSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid status" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const order = await updateOrderStatus(id, parseResult.data.status);
    
    return new Response(
      JSON.stringify({ success: true, order }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update order status error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update order status" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
