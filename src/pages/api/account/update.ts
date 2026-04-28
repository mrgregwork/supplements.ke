import type { APIRoute } from "astro";
import { getCustomer, getSessionByToken, updateCustomer } from "@lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
});

export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    const sessionToken = cookies.get('session')?.value;
    
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const session = await getSessionByToken(sessionToken);
    
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const body = await request.json();
    
    const parseResult = updateSchema.safeParse(body);
    
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => e.message).join(", ");
      return new Response(
        JSON.stringify({ error: errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const { firstName, lastName } = parseResult.data;
    
    const customer = await updateCustomer(session.customerId, {
      firstName: firstName || null,
      lastName: lastName || null,
    });
    
    return new Response(
      JSON.stringify({ success: true, customer }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update account error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update account" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
