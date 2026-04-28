import type { APIRoute } from "astro";
import { 
  generateOtpCode, 
  createOtpCode, 
  isValidEmail, 
  isValidPhone 
} from "@lib/auth";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { identifier } = body;
    
    if (!identifier || typeof identifier !== "string") {
      return new Response(
        JSON.stringify({ error: "Email or phone number is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const isEmail = isValidEmail(identifier);
    const isPhone = isValidPhone(identifier);
    
    if (!isEmail && !isPhone) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address or phone number" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const type = isEmail ? "email" : "sms";
    const code = generateOtpCode();
    
    await createOtpCode(identifier, code, type);
    
    // TODO: Send OTP via email/SMS service
    // For development, log to console
    console.log(`[OTP] ${type.toUpperCase()} code for ${identifier}: ${code}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Verification code sent to your ${type === "email" ? "email" : "phone"}`,
        type,
        // Only return code in development for testing
        ...(process.env.NODE_ENV !== "production" && { devCode: code }),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Request OTP error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send verification code" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
