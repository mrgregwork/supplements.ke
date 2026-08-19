import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertBlogCategorySchema } from "@shared/schema";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { UNCATEGORIZED_BLOG_SLUG } from "@lib/seo";
import { sanitizeHTML } from "@lib/sanitize";

async function requireAdmin(request: Request) {
  const sessionToken = getAdminSessionToken(request);
  const sessionData = await verifyAdminSession(sessionToken);
  return import.meta.env.DEV || !!sessionData;
}

export const PUT: APIRoute = async ({ request, params }) => {
  try {
    if (!(await requireAdmin(request))) {
      return new Response(JSON.stringify({ error: "Unauthorised" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const body = await request.json();
    const data = insertBlogCategorySchema.partial().parse(body);

    if (data.description !== undefined) data.description = sanitizeHTML(data.description);
    if (data.longDescription !== undefined) data.longDescription = sanitizeHTML(data.longDescription);

    if (data.slug === UNCATEGORIZED_BLOG_SLUG) {
      return new Response(
        JSON.stringify({ error: `"${UNCATEGORIZED_BLOG_SLUG}" is a reserved slug — please choose another.` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (data.slug) {
      const existing = await storage.getBlogCategoryBySlug(data.slug);
      if (existing && existing.id !== params.id) {
        return new Response(
          JSON.stringify({ error: "A category with this slug already exists" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const category = await storage.updateBlogCategory(params.id!, data);
    if (!category) {
      return new Response(JSON.stringify({ error: "Category not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(category), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Update blog category error:", error);
    if (error.name === "ZodError") {
      return new Response(JSON.stringify({ error: "Invalid data", details: error.errors }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Failed to update blog category" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    if (!(await requireAdmin(request))) {
      return new Response(JSON.stringify({ error: "Unauthorised" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    // Posts in this category are not deleted — the categoryId FK is
    // ON DELETE SET NULL, so they fall back to "uncategorised".
    await storage.deleteBlogCategory(params.id!);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Delete blog category error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete blog category" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
