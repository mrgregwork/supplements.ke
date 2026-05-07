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
  const startTerm = `${q}%`;

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
      and(
        eq(products.status, 'active'),
        or(
          ilike(products.name, term),
          ilike(products.brand, term),
          ilike(products.description, term)
        )
      )
    )
    .orderBy(sql`
      CASE
        WHEN lower(${products.name}) = lower(${q}) THEN 0
        WHEN lower(${products.name}) LIKE lower(${startTerm}) THEN 1
        WHEN lower(${products.name}) LIKE lower(${term}) THEN 2
        WHEN lower(${products.brand}) LIKE lower(${startTerm}) THEN 3
        ELSE 4
      END,
      ${products.name}
    `)
    .limit(8);

  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' },
  });
};
