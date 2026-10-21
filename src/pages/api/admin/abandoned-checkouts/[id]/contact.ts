import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { markAbandonedCheckoutContacted } from "@lib/abandonedCheckouts";

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);

    if (!import.meta.env.DEV && !sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: "ID is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const row = await markAbandonedCheckoutContacted(id);
    if (!row) {
      return new Response(JSON.stringify({ error: "Abandoned checkout not found" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, checkout: row }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Mark abandoned checkout contacted error:", error);
    return new Response(JSON.stringify({ error: "Failed to update" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
