import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertBlogCategorySchema } from "@shared/schema";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

export const GET: APIRoute = async () => {
  try {
    const categories = await storage.getBlogCategories();
    return new Response(JSON.stringify(categories), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get blog categories error:", error);
    return new Response(JSON.stringify({ error: "Failed to get blog categories" }), {
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
    const data = insertBlogCategorySchema.parse(body);

    const existing = await storage.getBlogCategoryBySlug(data.slug);
    if (existing) {
      return new Response(
        JSON.stringify({ error: "A category with this slug already exists" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const category = await storage.createBlogCategory(data);
    return new Response(JSON.stringify(category), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Create blog category error:", error);
    if (error.name === "ZodError") {
      return new Response(
        JSON.stringify({ error: "Invalid data", details: error.errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: "Failed to create blog category" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
