import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession, deleteStaffAdmin } from "@lib/admin";

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    const isDev = import.meta.env.DEV;

    if (!isDev && !sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    // Defense in depth -- src/middleware.ts already keeps a 'staff' session
    // from reaching this route at all.
    if (sessionData?.admin.role === "staff") {
      return new Response(JSON.stringify({ error: "Not permitted for this account." }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: "Account ID is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // deleteStaffAdmin's own WHERE clause only ever matches a role='staff'
    // row -- this can never remove the main admin account, even if its id
    // were passed here directly.
    await deleteStaffAdmin(id);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Delete staff account error:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to remove staff account" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
