import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertContentPageSchema } from "@shared/schema";
import { sanitizeHTML } from "@lib/sanitize";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

export const GET: APIRoute = async ({ params }) => {
  try {
    const page = await storage.getContentPage(params.id!);
    if (!page) {
      return new Response(JSON.stringify({ error: "Content page not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(page), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get content page error:", error);
    return new Response(JSON.stringify({ error: "Failed to get content page" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const PUT: APIRoute = async ({ request, params }) => {
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
    const data = insertContentPageSchema.partial().parse(body);

    if (data.content !== undefined) data.content = sanitizeHTML(data.content);

    const page = await storage.updateContentPage(params.id!, data);
    if (!page) {
      return new Response(JSON.stringify({ error: "Content page not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(page), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Update content page error:", error);
    if (error.name === "ZodError") {
      return new Response(
        JSON.stringify({ error: "Invalid data", details: error.errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: "Failed to update content page" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    if (!import.meta.env.DEV && !sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorised" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await storage.deleteContentPage(params.id!);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delete content page error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete content page" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
