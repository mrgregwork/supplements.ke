import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { fulfillRefundRequest } from "@lib/refunds";
import { z } from "zod";

const bodySchema = z.object({
  fulfillmentReference: z.string().min(1),
  fulfillmentNote: z.string().optional(),
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

    const { id: refundRequestId } = params;
    if (!refundRequestId) {
      return new Response(JSON.stringify({ error: "Refund request ID is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "A reference for the money actually sent back is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const fulfilledByEmail = sessionData?.admin?.email || "dev@local";
    const result = await fulfillRefundRequest(refundRequestId, {
      fulfilledByEmail,
      fulfillmentReference: parsed.data.fulfillmentReference,
      fulfillmentNote: parsed.data.fulfillmentNote,
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
    console.error("Fulfill refund request error:", error);
    return new Response(JSON.stringify({ error: "Failed to mark refund as fulfilled" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
