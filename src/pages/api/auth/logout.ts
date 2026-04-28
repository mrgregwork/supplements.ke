import type { APIRoute } from "astro";
import { getSessionByToken, deleteSession } from "@lib/auth";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get("session")?.value;
    
    if (token) {
      const session = await getSessionByToken(token);
      if (session) {
        await deleteSession(session.id);
      }
    }
    
    cookies.delete("session", { path: "/" });
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Logout error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to logout" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
