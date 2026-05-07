import type { APIRoute } from 'astro';
import { db } from '../../../../server/db';
import { products, categories, subcategories } from '@shared/schema';
import { ilike, or, eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Static pages always available regardless of search query
const STATIC_PAGES = [
  { label: 'Home',                    url: '/',                      type: 'page' },
  { label: 'All Supplements',         url: '/all-supplements/',      type: 'page' },
  { label: 'Vitamins & Minerals',     url: '/vitamins/',             type: 'page' },
  { label: 'Protein',                 url: '/protein/',              type: 'page' },
  { label: 'Collagen',                url: '/collagen/',             type: 'page' },
  { label: 'Weight Management',       url: '/weight-management/',    type: 'page' },
  { label: "Women's Health",          url: '/womens-health/',        type: 'page' },
  { label: "Men's Health",            url: '/mens-health/',          type: 'page' },
  { label: 'Specialty Supplements',   url: '/specialty-supplements/', type: 'page' },
  { label: 'Herbal & Natural',        url: '/herbal-supplements/',   type: 'page' },
  { label: 'Minerals',                url: '/minerals/',             type: 'page' },
  { label: 'Probiotics & Gut Health', url: '/probiotics-gut-health/', type: 'page' },
];

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';

  // Empty query: return static pages only (common pages panel)
  if (q.length < 2) {
    return new Response(JSON.stringify({ static: STATIC_PAGES, results: [] }), { headers: JSON_HEADERS });
  }

  const term      = `%${q}%`;
  const startTerm = `${q}%`;
  const qLower    = q.toLowerCase();

  try {
    // Run all three queries in parallel
    const [productRows, categoryRows, subcategoryRows] = await Promise.all([
      // Products
      db
        .select({
          name:            products.name,
          brand:           products.brand,
          slug:            products.slug,
          categorySlug:    products.categorySlug,
          subcategorySlug: products.subcategorySlug,
        })
        .from(products)
        .where(
          and(
            eq(products.status, 'active'),
            or(ilike(products.name, term), ilike(products.brand, term))
          )
        )
        .orderBy(sql`
          CASE
            WHEN lower(${products.name}) = lower(${q})             THEN 0
            WHEN lower(${products.name}) LIKE lower(${startTerm})  THEN 1
            WHEN lower(${products.name}) LIKE lower(${term})       THEN 2
            WHEN lower(${products.brand}) LIKE lower(${startTerm}) THEN 3
            ELSE 4
          END, ${products.name}
        `)
        .limit(6),

      // Categories
      db
        .select({ name: categories.name, slug: categories.slug })
        .from(categories)
        .where(and(eq(categories.isActive, true), ilike(categories.name, term)))
        .limit(4),

      // Subcategories — need category slug for URL
      db
        .select({
          name:         subcategories.name,
          slug:         subcategories.slug,
          categorySlug: sql<string>`(
            SELECT slug FROM categories WHERE id = ${subcategories.categoryId} LIMIT 1
          )`,
        })
        .from(subcategories)
        .where(and(eq(subcategories.isActive, true), ilike(subcategories.name, term)))
        .limit(6),
    ]);

    // Shape into a unified result list
    const results: { label: string; sublabel: string; url: string; type: string }[] = [];

    for (const cat of categoryRows) {
      results.push({
        label:    cat.name,
        sublabel: `/${cat.slug}/`,
        url:      `/${cat.slug}/`,
        type:     'category',
      });
    }

    for (const sub of subcategoryRows) {
      const catSlug = sub.categorySlug ?? '';
      results.push({
        label:    sub.name,
        sublabel: `/${catSlug}/${sub.slug}/`,
        url:      `/${catSlug}/${sub.slug}/`,
        type:     'subcategory',
      });
    }

    for (const p of productRows) {
      const url = `/${p.categorySlug}/${p.subcategorySlug}/${p.slug}/`;
      results.push({
        label:    p.name,
        sublabel: `${p.brand ? p.brand + ' · ' : ''}${url}`,
        url,
        type: 'product',
      });
    }

    // Filter static pages that match the query
    const matchingStatic = STATIC_PAGES.filter(p =>
      p.label.toLowerCase().includes(qLower) || p.url.includes(qLower)
    );

    return new Response(JSON.stringify({ static: matchingStatic, results }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error('[link-search] DB error:', err);
    return new Response(JSON.stringify({ static: [], results: [] }), { status: 500, headers: JSON_HEADERS });
  }
};
