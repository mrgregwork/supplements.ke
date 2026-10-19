import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { requestRefund } from "@lib/refunds";
import { z } from "zod";

const bodySchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
  itemIds: z.array(z.string()).nullable().optional(),
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
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const requestedByEmail = sessionData?.admin?.email || "dev@local";
    const result = await requestRefund(orderId, {
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      itemIds: parsed.data.itemIds ?? null,
      requestedByEmail,
    });

    if ("error" in result) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, refundRequest: result.refundRequest }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Request refund error:", error);
    return new Response(JSON.stringify({ error: "Failed to request refund" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
