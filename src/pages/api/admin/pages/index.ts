import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertContentPageSchema } from "@shared/schema";
import { sanitizeHTML } from "@lib/sanitize";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

export const GET: APIRoute = async () => {
  try {
    const pages = await storage.getContentPages();
    return new Response(JSON.stringify(pages), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get content pages error:", error);
    return new Response(JSON.stringify({ error: "Failed to get content pages" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    if (!import.meta.env.DEV && !sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorised" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const data = insertContentPageSchema.parse(body);

    if (data.content) data.content = sanitizeHTML(data.content);

    // Check for duplicate slug
    const existing = await storage.getContentPageBySlug(data.slug);
    if (existing) {
      return new Response(
        JSON.stringify({ error: "A page with this slug already exists" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const page = await storage.createContentPage(data);
    return new Response(JSON.stringify(page), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Create content page error:", error);
    if (error.name === "ZodError") {
      return new Response(
        JSON.stringify({ error: "Invalid data", details: error.errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: "Failed to create content page" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
