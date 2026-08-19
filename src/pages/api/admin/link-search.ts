import type { APIRoute } from 'astro';
import { db } from '../../../../server/db';
import { products, categories, subcategories, blogPosts, blogCategories, contentPages } from '@shared/schema';
import { ilike, or, eq, and, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { generateBlogPostUrl } from '@lib/seo';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const STATIC_PAGES = [
  { label: 'Home',                    url: '/' },
  { label: 'All Supplements',         url: '/all-supplements/' },
  { label: 'Vitamins & Minerals',     url: '/vitamins/' },
  { label: 'Protein',                 url: '/protein/' },
  { label: 'Collagen',                url: '/collagen/' },
  { label: 'Weight Management',       url: '/weight-management/' },
  { label: "Women's Health",          url: '/womens-health/' },
  { label: "Men's Health",            url: '/mens-health/' },
  { label: 'Specialty Supplements',   url: '/specialty-supplements/' },
  { label: 'Herbal & Natural',        url: '/herbal-supplements/' },
  { label: 'Minerals',                url: '/minerals/' },
  { label: 'Probiotics & Gut Health', url: '/probiotics-gut-health/' },
];

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';

  // Empty query — return static common pages, no DB hit
  if (q.length < 2) {
    const staticResults = STATIC_PAGES.map(p => ({
      label: p.label, sublabel: p.url, url: p.url, type: 'page'
    }));
    return new Response(JSON.stringify({ results: staticResults }), { headers: JSON_HEADERS });
  }

  const term      = `%${q}%`;
  const startTerm = `${q}%`;

  try {
    const [productRows, categoryRows, subcategoryRows, blogRows, pageRows] = await Promise.all([

      // Products — name or brand match
      db
        .select({
          name:            products.name,
          slug:            products.slug,
          categorySlug:    products.categorySlug,
          subcategorySlug: products.subcategorySlug,
          brand:           products.brand,
        })
        .from(products)
        .where(and(
          eq(products.status, 'active'),
          or(ilike(products.name, term), ilike(products.brand, term))
        ))
        .orderBy(sql`
          CASE
            WHEN lower(${products.name}) = lower(${q})              THEN 0
            WHEN lower(${products.name}) LIKE lower(${startTerm})   THEN 1
            WHEN lower(${products.name}) LIKE lower(${term})        THEN 2
            WHEN lower(${products.brand}) LIKE lower(${startTerm})  THEN 3
            ELSE 4
          END, ${products.name}
        `)
        .limit(8),

      // Categories — name match
      db
        .select({ name: categories.name, slug: categories.slug })
        .from(categories)
        .where(and(eq(categories.isActive, true), ilike(categories.name, term)))
        .limit(5),

      // Subcategories — name match, JOIN categories for the URL slug
      db
        .select({
          name:         subcategories.name,
          slug:         subcategories.slug,
          categorySlug: categories.slug,
        })
        .from(subcategories)
        .innerJoin(categories, eq(subcategories.categoryId, categories.id))
        .where(and(eq(subcategories.isActive, true), ilike(subcategories.name, term)))
        .limit(8),

      // Blog posts
      db
        .select({ title: blogPosts.title, slug: blogPosts.slug, categoryId: blogPosts.categoryId })
        .from(blogPosts)
        .where(and(eq(blogPosts.status, 'published'), ilike(blogPosts.title, term)))
        .limit(5),

      // Content pages
      db
        .select({ title: contentPages.title, slug: contentPages.slug })
        .from(contentPages)
        .where(and(eq(contentPages.status, 'published'), ilike(contentPages.title, term)))
        .limit(5),
    ]);

    // Build unified result list
    const results: { label: string; sublabel: string; url: string; type: string }[] = [];

    for (const cat of categoryRows) {
      results.push({ label: cat.name, sublabel: `/${cat.slug}/`, url: `/${cat.slug}/`, type: 'category' });
    }

    for (const sub of subcategoryRows) {
      const pageUrl = `/${sub.categorySlug}/${sub.slug}/`;
      results.push({ label: sub.name, sublabel: pageUrl, url: pageUrl, type: 'subcategory' });
    }

    for (const p of productRows) {
      const pageUrl = `/${p.categorySlug}/${p.subcategorySlug}/${p.slug}/`;
      const sublabel = p.brand ? `${p.brand} · ${pageUrl}` : pageUrl;
      results.push({ label: p.name, sublabel, url: pageUrl, type: 'product' });
    }

    const blogCategoryIds = [...new Set(blogRows.map(b => b.categoryId).filter((id): id is string => !!id))];
    const blogCategoryRows = blogCategoryIds.length
      ? await db.select({ id: blogCategories.id, slug: blogCategories.slug }).from(blogCategories).where(inArray(blogCategories.id, blogCategoryIds))
      : [];
    const blogCategorySlugById = new Map(blogCategoryRows.map(c => [c.id, c.slug]));

    for (const b of blogRows) {
      const pageUrl = generateBlogPostUrl(b.categoryId ? blogCategorySlugById.get(b.categoryId) : null, b.slug);
      results.push({ label: b.title, sublabel: pageUrl, url: pageUrl, type: 'blog' });
    }

    for (const pg of pageRows) {
      const pageUrl = `/pages/${pg.slug}/`;
      results.push({ label: pg.title, sublabel: pageUrl, url: pageUrl, type: 'page' });
    }

    // Also include any static pages whose label/url contains the query
    const qLower = q.toLowerCase();
    const matchingStatic = STATIC_PAGES
      .filter(p => p.label.toLowerCase().includes(qLower) || p.url.includes(qLower))
      .map(p => ({ label: p.label, sublabel: p.url, url: p.url, type: 'page' }));

    // Prepend matching static pages before everything else
    const finalResults = [...matchingStatic, ...results];

    return new Response(JSON.stringify({ results: finalResults }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error('[link-search] error:', err);
    return new Response(JSON.stringify({ results: [] }), { status: 500, headers: JSON_HEADERS });
  }
};
