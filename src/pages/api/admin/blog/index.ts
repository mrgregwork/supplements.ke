import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertBlogPostSchema } from "@shared/schema";
import { sanitizeHTML } from "@lib/sanitize";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

export const GET: APIRoute = async () => {
  try {
    const posts = await storage.getBlogPosts();
    return new Response(JSON.stringify(posts), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get blog posts error:", error);
    return new Response(JSON.stringify({ error: "Failed to get blog posts" }), {
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
    const data = insertBlogPostSchema.parse(body);

    if (data.content) data.content = sanitizeHTML(data.content);

    // Check for duplicate slug
    const existing = await storage.getBlogPostBySlug(data.slug);
    if (existing) {
      return new Response(
        JSON.stringify({ error: "A blog post with this slug already exists" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const post = await storage.createBlogPost(data);
    return new Response(JSON.stringify(post), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Create blog post error:", error);
    if (error.name === "ZodError") {
      return new Response(
        JSON.stringify({ error: "Invalid data", details: error.errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: "Failed to create blog post" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
