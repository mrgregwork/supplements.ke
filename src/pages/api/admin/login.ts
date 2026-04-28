import type { APIRoute } from "astro";
import { getAdminByEmail, verifyPassword, createAdminSession } from "@lib/admin";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    
    const parseResult = loginSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const { email, password } = parseResult.data;
    
    const admin = await getAdminByEmail(email);
    
    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const isValid = await verifyPassword(password, admin.passwordHash);
    
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
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
  } catch (error) {
    console.error("Admin login error:", error);
    return new Response(
      JSON.stringify({ error: "Login failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
