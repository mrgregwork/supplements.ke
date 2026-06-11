import type { APIRoute } from "astro";
import { verifyOtpCode, markOtpUsed } from "@lib/auth";
import { getAdminByEmail, createAdminSession } from "@lib/admin";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: "Email and code are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (String(code).length !== 6) {
      return new Response(
        JSON.stringify({ error: "Code must be 6 digits" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const normalised = email.trim().toLowerCase();

    const otpRecord = await verifyOtpCode(normalised, String(code));
    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired code. Please request a new one." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const admin = await getAdminByEmail(normalised);
    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired code. Please request a new one." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    await markOtpUsed(otpRecord.id);

    const sessionToken = await createAdminSession(admin.id);

    cookies.set("adminSession", sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[admin-otp] verify error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to verify code. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
