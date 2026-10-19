import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { cancelRefundRequest } from "@lib/refunds";
import { z } from "zod";

const bodySchema = z.object({
  reason: z.string().min(1),
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
      return new Response(JSON.stringify({ error: "A reason is required to cancel a refund request" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const cancelledByEmail = sessionData?.admin?.email || "dev@local";
    const result = await cancelRefundRequest(refundRequestId, {
      cancelledByEmail,
      reason: parsed.data.reason,
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
    console.error("Cancel refund request error:", error);
    return new Response(JSON.stringify({ error: "Failed to cancel refund request" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
