import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertSubcategorySchema } from "@shared/schema";
import { sanitizeHTML } from "@lib/sanitize";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

export const GET: APIRoute = async () => {
  try {
    const subcategories = await storage.getSubcategories();
    return new Response(JSON.stringify(subcategories), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get subcategories error:", error);
    return new Response(JSON.stringify({ error: "Failed to get subcategories" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    if (!import.meta.env.DEV && !sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const body = await request.json();
    const data = insertSubcategorySchema.parse(body);
    
    if (data.description)     data.description     = sanitizeHTML(data.description);
    if (data.longDescription) data.longDescription = sanitizeHTML(data.longDescription);
    
    // Check for duplicate slug within the same category
    const existing = await storage.getSubcategoryBySlug(data.categoryId, data.slug);
    if (existing) {
      return new Response(JSON.stringify({ error: "A subcategory with this slug already exists" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const subcategory = await storage.createSubcategory(data);
    return new Response(JSON.stringify(subcategory), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Create subcategory error:", error);
    if (error.name === "ZodError") {
      return new Response(JSON.stringify({ error: "Invalid data", details: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "Failed to create subcategory" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
