import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertSubcategorySchema } from "@shared/schema";
import { sanitizeHTML } from "@lib/sanitize";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

export const GET: APIRoute = async ({ params }) => {
  try {
    const subcategory = await storage.getSubcategory(params.id!);
    if (!subcategory) {
      return new Response(JSON.stringify({ error: "Subcategory not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify(subcategory), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get subcategory error:", error);
    return new Response(JSON.stringify({ error: "Failed to get subcategory" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    if (!import.meta.env.DEV && !sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const body = await request.json();
    const data = insertSubcategorySchema.partial().parse(body);
    
    if (data.description !== undefined)     data.description     = sanitizeHTML(data.description);
    if (data.longDescription !== undefined) data.longDescription = sanitizeHTML(data.longDescription);
    
    const subcategory = await storage.updateSubcategory(params.id!, data);
    if (!subcategory) {
      return new Response(JSON.stringify({ error: "Subcategory not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify(subcategory), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Update subcategory error:", error);
    if (error.name === "ZodError") {
      return new Response(JSON.stringify({ error: "Invalid data", details: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "Failed to update subcategory" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    if (!import.meta.env.DEV && !sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    await storage.deleteSubcategory(params.id!);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Delete subcategory error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete subcategory" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
