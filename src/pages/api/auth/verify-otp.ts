import type { APIRoute } from "astro";
import { 
  verifyOtpCode, 
  markOtpUsed, 
  getCustomerByIdentifier, 
  createCustomer, 
  createSession,
  isValidEmail 
} from "@lib/auth";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { identifier, code } = body;
    
    if (!identifier || !code) {
      return new Response(
        JSON.stringify({ error: "Identifier and code are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    if (code.length !== 6) {
      return new Response(
        JSON.stringify({ error: "OTP must be 6 digits" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const otpRecord = await verifyOtpCode(identifier, code);
    
    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    await markOtpUsed(otpRecord.id);
    
    // Find or create customer
    let customer = await getCustomerByIdentifier(identifier);
    
    if (!customer) {
      const isEmail = isValidEmail(identifier);
      customer = await createCustomer({
        email: isEmail ? identifier : null,
        phone: !isEmail ? identifier : null,
      });
    }
    
    // Create session
    const session = await createSession(customer.id);
    
    // Set cookie
    cookies.set("session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: "/",
    });
    
    return new Response(
      JSON.stringify({ 
        success: true,
        customer: {
          id: customer.id,
          email: customer.email,
          phone: customer.phone,
          firstName: customer.firstName,
          lastName: customer.lastName,
        },
        token: session.token,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verify OTP error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to verify code" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
