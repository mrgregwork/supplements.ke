import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertCategorySchema } from "@shared/schema";
import { sanitizeHTML } from "@lib/sanitize";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

export const GET: APIRoute = async () => {
  try {
    const categories = await storage.getCategories();
    return new Response(JSON.stringify(categories), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return new Response(JSON.stringify({ error: "Failed to get categories" }), {
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
    const data = insertCategorySchema.parse(body);
    
    if (data.description)     data.description     = sanitizeHTML(data.description);
    if (data.longDescription) data.longDescription = sanitizeHTML(data.longDescription);
    
    // Check for duplicate slug
    const existing = await storage.getCategoryBySlug(data.slug);
    if (existing) {
      return new Response(JSON.stringify({ error: "A category with this slug already exists" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const category = await storage.createCategory(data);
    return new Response(JSON.stringify(category), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Create category error:", error);
    if (error.name === "ZodError") {
      return new Response(JSON.stringify({ error: "Invalid data", details: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "Failed to create category" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
