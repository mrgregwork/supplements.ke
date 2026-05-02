import type { APIRoute } from 'astro';
import { db } from '../../../server/db';
import { products } from '@shared/schema';
import { ilike, or, eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const term = `%${q}%`;

  const rows = await db
    .select({
      name: products.name,
      brand: products.brand,
      slug: products.slug,
      categorySlug: products.categorySlug,
      subcategorySlug: products.subcategorySlug,
      price: products.price,
    })
    .from(products)
    .where(
      or(
        ilike(products.name, term),
        ilike(products.brand, term)
      )
    )
    .orderBy(sql`
      CASE WHEN lower(${products.name}) LIKE lower(${q + '%'}) THEN 0 ELSE 1 END,
      ${products.name}
    `)
    .limit(8);

  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' },
  });
};
