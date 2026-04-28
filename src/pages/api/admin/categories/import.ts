import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { sanitizeHTML } from "@lib/sanitize";
import { z } from "zod";

const MAX_ROWS = 500;

const categoryRowSchema = z.object({
  category: z.string().transform(s => s.trim()).pipe(z.string().min(1).max(200)),
  subcategory: z.string().optional().default("").transform(s => s.trim()),
  description: z.string().optional().default("").transform(s => s.trim()),
  seoTitle: z.string().optional().default("").transform(s => s.trim()),
  seoDescription: z.string().optional().default("").transform(s => s.trim()),
  heroImage: z.string().optional().default("").transform(s => s.trim()),
});

const importSchema = z.object({
  rows: z.array(categoryRowSchema).min(1).max(MAX_ROWS),
});

function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "";
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    const isDev = import.meta.env.DEV;
    if (!isDev && !sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const parseResult = importSchema.safeParse(body);

    if (!parseResult.success) {
      const errors = parseResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return new Response(JSON.stringify({ error: errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { rows } = parseResult.data;

    const existingCategories = await storage.getCategories();
    const existingSubcategories = await storage.getSubcategories();

    const categoryMap = new Map<string, string>();
    for (const cat of existingCategories) {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    }

    const existingSlugMap = new Map<string, string>();
    for (const cat of existingCategories) {
      existingSlugMap.set(cat.slug, cat.name);
    }

    const subcategorySet = new Set<string>();
    for (const sub of existingSubcategories) {
      subcategorySet.add(`${sub.categoryId}::${sub.name.toLowerCase()}`);
    }

    let categoriesCreated = 0;
    let subcategoriesCreated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const uniqueCategories = [...new Set(rows.map((r) => r.category))];

    for (const catName of uniqueCategories) {
      if (categoryMap.has(catName.toLowerCase())) {
        skipped++;
        continue;
      }

      const catRow = rows.find((r) => r.category === catName && !r.subcategory);
      const slug = generateSlug(catName);

      if (!slug) {
        errors.push(`Category "${catName}" produces an invalid slug. Use alphanumeric characters.`);
        continue;
      }

      const existingBySlug = await storage.getCategoryBySlug(slug);
      if (existingBySlug) {
        if (existingBySlug.name.toLowerCase() === catName.toLowerCase()) {
          categoryMap.set(catName.toLowerCase(), existingBySlug.id);
          skipped++;
        } else {
          errors.push(`Category "${catName}" conflicts with existing category "${existingBySlug.name}" (same slug: "${slug}"). Rename or use a different name.`);
        }
        continue;
      }

      try {
        const description = catRow?.description
          ? sanitizeHTML(catRow.description)
          : "";
        const cat = await storage.createCategory({
          name: catName,
          slug,
          description,
          seoTitle: catRow?.seoTitle || null,
          seoDescription: catRow?.seoDescription || null,
          heroImage: catRow?.heroImage || null,
          isActive: true,
          sortOrder: 0,
        });
        categoryMap.set(catName.toLowerCase(), cat.id);
        categoriesCreated++;
      } catch (err: any) {
        errors.push(`Failed to create category "${catName}": ${err.message}`);
      }
    }

    for (const row of rows) {
      if (!row.subcategory) continue;

      const parentId = categoryMap.get(row.category.toLowerCase());
      if (!parentId) {
        errors.push(
          `Skipped subcategory "${row.subcategory}" - parent category "${row.category}" not found`
        );
        skipped++;
        continue;
      }

      const subKey = `${parentId}::${row.subcategory.toLowerCase()}`;
      if (subcategorySet.has(subKey)) {
        skipped++;
        continue;
      }

      const slug = generateSlug(row.subcategory);

      if (!slug) {
        errors.push(`Subcategory "${row.subcategory}" produces an invalid slug. Use alphanumeric characters.`);
        continue;
      }

      const existing = await storage.getSubcategoryBySlug(parentId, slug);
      if (existing) {
        subcategorySet.add(subKey);
        skipped++;
        continue;
      }

      try {
        const description = row.description
          ? sanitizeHTML(row.description)
          : "";
        await storage.createSubcategory({
          name: row.subcategory,
          slug,
          categoryId: parentId,
          description,
          seoTitle: row.seoTitle || null,
          seoDescription: row.seoDescription || null,
          heroImage: row.heroImage || null,
          isActive: true,
          sortOrder: 0,
        });
        subcategorySet.add(subKey);
        subcategoriesCreated++;
      } catch (err: any) {
        errors.push(
          `Failed to create subcategory "${row.subcategory}": ${err.message}`
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        categoriesCreated,
        subcategoriesCreated,
        skipped,
        errors,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Category import error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to import categories",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
