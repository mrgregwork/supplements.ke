import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { z } from "zod";

const MAX_ROWS = 500;

const productRowSchema = z.object({
  name: z.string().transform(s => s.trim()).pipe(z.string().min(1).max(500)),
  description: z.string().transform(s => s.trim()).pipe(z.string().min(1).max(5000)),
  longDescription: z.string().optional().default("").transform(s => s.trim()),
  price: z.number().positive().max(999999),
  originalPrice: z.number().positive().max(999999).optional(),
  currency: z.string().optional().default("USD"),
  brand: z.string().optional().default("").transform(s => s.trim()),
  sku: z.string().optional().default("").transform(s => s.trim()),
  category: z.string().transform(s => s.trim()).pipe(z.string().min(1)),
  subcategory: z.string().optional().default("").transform(s => s.trim()),
  images: z.string().optional().default("").transform(s => s.trim()),
  inStock: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
  status: z.enum(["active", "draft"]).optional().default("active"),
  seoTitle: z.string().optional().default("").transform(s => s.trim()),
  seoDescription: z.string().optional().default("").transform(s => s.trim()),
});

const importSchema = z.object({
  rows: z.array(productRowSchema).min(1).max(MAX_ROWS),
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

    const categories = await storage.getCategories();
    const subcategories = await storage.getSubcategories();

    const categoryByName = new Map<string, { id: string; slug: string }>();
    for (const cat of categories) {
      categoryByName.set(cat.name.toLowerCase(), {
        id: cat.id,
        slug: cat.slug,
      });
    }

    const subcategoryByName = new Map<
      string,
      { id: string; slug: string; categoryId: string }
    >();
    for (const sub of subcategories) {
      subcategoryByName.set(
        `${sub.categoryId}::${sub.name.toLowerCase()}`,
        { id: sub.id, slug: sub.slug, categoryId: sub.categoryId }
      );
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const catInfo = categoryByName.get(row.category.toLowerCase());
      if (!catInfo) {
        errors.push(
          `Row ${i + 1}: Category "${row.category}" not found. Create it first.`
        );
        skipped++;
        continue;
      }

      let subInfo: { id: string; slug: string } | null = null;
      if (row.subcategory) {
        const subKey = `${catInfo.id}::${row.subcategory.toLowerCase()}`;
        const found = subcategoryByName.get(subKey);
        if (!found) {
          errors.push(
            `Row ${i + 1}: Subcategory "${row.subcategory}" not found under "${row.category}". Create it first.`
          );
          skipped++;
          continue;
        }
        subInfo = found;
      }

      let baseSlug = generateSlug(row.name);
      if (!baseSlug) {
        errors.push(`Row ${i + 1}: Product name "${row.name}" produces an invalid slug. Use alphanumeric characters.`);
        skipped++;
        continue;
      }

      let slug = baseSlug;
      let slugSuffix = 0;
      const maxAttempts = 20;
      let slugExists = true;
      while (slugExists && slugSuffix < maxAttempts) {
        const testSlug = slugSuffix === 0 ? baseSlug : `${baseSlug}-${slugSuffix}`;
        const existing = await storage.getProductBySlug(testSlug);
        if (!existing) {
          slug = testSlug;
          slugExists = false;
        } else {
          slugSuffix++;
        }
      }

      if (slugExists) {
        errors.push(`Row ${i + 1}: Could not generate unique slug for "${row.name}".`);
        skipped++;
        continue;
      }

      const imageArray = row.images
        ? row.images
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      try {
        await storage.createProduct({
          name: row.name,
          slug,
          description: row.description,
          longDescription: row.longDescription || null,
          price: row.price,
          originalPrice: row.originalPrice || null,
          currency: row.currency || "USD",
          images: imageArray,
          brand: row.brand || null,
          sku: row.sku || null,
          categoryId: catInfo.id,
          subcategoryId: subInfo?.id || null,
          categorySlug: catInfo.slug,
          subcategorySlug: subInfo?.slug || null,
          attributes: [],
          inStock: row.inStock ?? true,
          featured: row.featured ?? false,
          status: row.status || "active",
          seoTitle: row.seoTitle || null,
          seoDescription: row.seoDescription || null,
        });
        created++;
      } catch (err: any) {
        errors.push(
          `Row ${i + 1}: Failed to create "${row.name}": ${err.message}`
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, created, skipped, errors }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Product import error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to import products",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
