import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { addOrderNote } from "@lib/orderNotes";
import { z } from "zod";

const bodySchema = z.object({
  message: z.string().min(1),
});

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);

    if (!import.meta.env.DEV && !sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const { id: orderId } = params;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Order ID is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "A note message is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const createdByEmail = sessionData?.admin?.email || "dev@local";
    const note = await addOrderNote(orderId, parsed.data.message, createdByEmail);

    return new Response(JSON.stringify({ success: true, note }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Add order note error:", error);
    return new Response(JSON.stringify({ error: "Failed to add note" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
