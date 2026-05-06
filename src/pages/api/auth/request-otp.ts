import type { APIRoute } from "astro";
import { generateOtpCode, createOtpCode, isValidEmail } from "@lib/auth";
import { sendOtpEmail } from "../../../../server/email";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { identifier } = body;

    if (!identifier || typeof identifier !== "string") {
      return new Response(
        JSON.stringify({ error: "Email address is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const email = identifier.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const code = generateOtpCode();
    await createOtpCode(email, code, "email");

    // Send the OTP via email
    try {
      await sendOtpEmail(email, code);
    } catch (emailErr) {
      console.error("[OTP] Email send failed:", emailErr);
      // In development, fall back to logging the code
      if (process.env.NODE_ENV !== "production") {
        console.log(`[OTP DEV] Code for ${email}: ${code}`);
        return new Response(
          JSON.stringify({
            success: true,
            message: "Check your email for your login code",
            devCode: code, // visible in dev only
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Failed to send login code. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Check your email for your login code",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Request OTP error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send login code. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
