import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession, updateProduct, deleteProduct, getProductById } from "@lib/admin";
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

export const PUT: APIRoute = async ({ params, request }) => {
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
    
    const { id } = params;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Product ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const existingProduct = await getProductById(id);
    
    if (!existingProduct) {
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
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
    
    const product = await updateProduct(id, parseResult.data);
    
    return new Response(
      JSON.stringify({ success: true, product }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Update product error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to update product" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
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
    
    const { id } = params;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Product ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    await deleteProduct(id);
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Delete product error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to delete product" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
