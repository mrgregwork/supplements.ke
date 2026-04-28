import type { APIRoute } from "astro";
import { getCustomerFromRequest } from "@lib/auth";

export const GET: APIRoute = async ({ request }) => {
  try {
    const customer = await getCustomerFromRequest(request);
    
    if (!customer) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({
        customer: {
          id: customer.id,
          email: customer.email,
          phone: customer.phone,
          firstName: customer.firstName,
          lastName: customer.lastName,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get me error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get user info" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
