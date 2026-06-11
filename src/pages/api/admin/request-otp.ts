import type { APIRoute } from "astro";
import { generateOtpCode, createOtpCode } from "@lib/auth";
import { getAdminByEmail } from "@lib/admin";
import { sendOtpEmail } from "../../../../server/email";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const normalised = email.trim().toLowerCase();

    // Silently succeed even if email isn't an admin — avoids enumeration
    const admin = await getAdminByEmail(normalised);
    if (admin) {
      const code = generateOtpCode();
      await createOtpCode(normalised, code, "email");
      try {
        await sendOtpEmail(normalised, code);
      } catch (err) {
        console.error("[admin-otp] Email send failed:", err);
        if (process.env.NODE_ENV !== "production") {
          console.log(`[admin-otp DEV] Code for ${normalised}: ${code}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "If that email is registered, a code has been sent." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[admin-otp] request error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to send code. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
