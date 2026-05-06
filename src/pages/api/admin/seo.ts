import type { APIRoute } from "astro";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { storage } from "@lib/storage";
import { z } from "zod";

const seoSchema = z.object({
  entityType: z.enum(["product", "category", "subcategory"]),
  entityId: z.string().min(1),
  seoTitle: z.string().max(120).nullable(),
  seoDescription: z.string().max(320).nullable(),
});

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
    const parsed = seoSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { entityType, entityId, seoTitle, seoDescription } = parsed.data;
    const update = { seoTitle: seoTitle || null, seoDescription: seoDescription || null };

    if (entityType === "product") {
      await storage.updateProduct(entityId, update);
    } else if (entityType === "category") {
      await storage.updateCategory(entityId, update);
    } else if (entityType === "subcategory") {
      await storage.updateSubcategory(entityId, update);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("SEO update error:", error);
    return new Response(JSON.stringify({ error: "Failed to update SEO data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
