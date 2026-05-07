import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession, createProduct } from "@lib/admin";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  longDescription: z.string().nullable().optional(),
  price: z.number().positive(),
  originalPrice: z.number().positive().nullable().optional(),
  currency: z.string().default("KES"),
  images: z.array(z.string()).default([]),
  brand: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  categorySlug: z.string().min(1),
  subcategorySlug: z.string().nullable().optional().default(""),
  tags: z.array(z.string()).default([]),
  additionalCategoryIds: z.array(z.string()).default([]),
  inStock: z.boolean().default(true),
  featured: z.boolean().default(false),
  status: z.enum(["active", "draft"]).default("active"),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    const isDev = import.meta.env.DEV;

    if (!isDev && !sessionData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const parseResult = productSchema.safeParse(body);
    
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return new Response(
        JSON.stringify({ error: errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const product = await createProduct(parseResult.data);
    
    return new Response(
      JSON.stringify({ success: true, product }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Create product error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create product" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
