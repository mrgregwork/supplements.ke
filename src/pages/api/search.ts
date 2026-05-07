import type { APIRoute } from 'astro';
import { db } from '../../../server/db';
import { products } from '@shared/schema';
import { ilike, or, eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return new Response(JSON.stringify([]), { headers: JSON_HEADERS });
  }

  const term = `%${q}%`;
  const startTerm = `${q}%`;

  try {
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

    return new Response(JSON.stringify(rows), { headers: JSON_HEADERS });
  } catch (err) {
    console.error('[search] DB error:', err);
    return new Response(JSON.stringify([]), { status: 500, headers: JSON_HEADERS });
  }
};
