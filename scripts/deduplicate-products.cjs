require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (no changes) ===' : '=== LIVE RUN ===');

  // 1. Find the single canonical row to KEEP per unique product name
  //    (earliest created_at = the original import = clean base slug)
  const { rows: keepRows } = await pool.query(`
    SELECT DISTINCT ON (LOWER(TRIM(name)))
           id, name, slug
    FROM products
    ORDER BY LOWER(TRIM(name)), created_at ASC
  `);
  const keepIds = keepRows.map(r => r.id);
  console.log(`\nKeeping  : ${keepIds.length} canonical products`);

  // 2. Count duplicates
  const { rows: [{ dup_count }] } = await pool.query(
    `SELECT COUNT(*) AS dup_count FROM products WHERE id != ALL($1::text[])`,
    [keepIds]
  );
  console.log(`Deleting : ${dup_count} duplicate rows`);

  // 3. Check for FK references on rows we plan to delete
  let cartRefs = 0, orderRefs = 0;
  try {
    const r = await pool.query(
      `SELECT COUNT(*) AS n FROM cart_items WHERE product_id != ALL($1::text[])`,
      [keepIds]
    );
    cartRefs = Number(r.rows[0].n);
  } catch (_) {}
  try {
    const r = await pool.query(
      `SELECT COUNT(*) AS n FROM order_items WHERE product_id != ALL($1::text[])`,
      [keepIds]
    );
    orderRefs = Number(r.rows[0].n);
  } catch (_) {}

  console.log(`Cart refs on duplicates : ${cartRefs}`);
  console.log(`Order refs on duplicates: ${orderRefs}`);

  if (DRY_RUN) {
    const { rows: sample } = await pool.query(
      `SELECT name, slug FROM products WHERE id != ALL($1::text[]) ORDER BY slug LIMIT 20`,
      [keepIds]
    );
    console.log('\nSample rows that would be deleted:');
    sample.forEach(r => console.log(`  - ${r.slug}`));
    console.log('\nRun without --dry-run to apply.');
    await pool.end();
    return;
  }

  // 4. Reassign cart_items references from duplicates → canonical
  if (cartRefs > 0) {
    await pool.query(`
      UPDATE cart_items ci
      SET product_id = canonical.id
      FROM (
        SELECT DISTINCT ON (LOWER(TRIM(p.name)))
               p.id, LOWER(TRIM(p.name)) AS norm
        FROM products p
        ORDER BY LOWER(TRIM(p.name)), p.created_at ASC
      ) canonical
      JOIN products dup
        ON LOWER(TRIM(dup.name)) = canonical.norm AND dup.id != canonical.id
      WHERE ci.product_id = dup.id
    `);
    console.log(`Reassigned ${cartRefs} cart_items to canonical products.`);
  }

  // 5. Reassign order_items references from duplicates → canonical
  if (orderRefs > 0) {
    await pool.query(`
      UPDATE order_items oi
      SET product_id = canonical.id
      FROM (
        SELECT DISTINCT ON (LOWER(TRIM(p.name)))
               p.id, LOWER(TRIM(p.name)) AS norm
        FROM products p
        ORDER BY LOWER(TRIM(p.name)), p.created_at ASC
      ) canonical
      JOIN products dup
        ON LOWER(TRIM(dup.name)) = canonical.norm AND dup.id != canonical.id
      WHERE oi.product_id = dup.id
    `);
    console.log(`Reassigned ${orderRefs} order_items to canonical products.`);
  }

  // 6. Delete all non-canonical rows
  const { rowCount } = await pool.query(
    `DELETE FROM products WHERE id != ALL($1::text[])`,
    [keepIds]
  );
  console.log(`\n✓ Deleted ${rowCount} duplicate products.`);

  // 7. Verify
  const { rows: [final] } = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(DISTINCT LOWER(TRIM(name))) AS unique_names
    FROM products
  `);
  console.log(`\nFinal state:`);
  console.log(`  Total products : ${final.total}`);
  console.log(`  Unique names   : ${final.unique_names}`);

  if (Number(final.total) !== Number(final.unique_names)) {
    console.log('  ⚠  Still some duplicates — investigate manually.');
  } else {
    console.log('  ✓  No duplicates remain.');
  }

  // 8. Also verify no numeric-suffix slugs remain
  const { rows: [{ suffixed }] } = await pool.query(
    `SELECT COUNT(*) AS suffixed FROM products WHERE slug ~ '-[0-9]+$'`
  );
  if (Number(suffixed) > 0) {
    console.log(`  ⚠  ${suffixed} slugs still have a numeric suffix — may be intentional size variants.`);
    const { rows: sv } = await pool.query(
      `SELECT slug FROM products WHERE slug ~ '-[0-9]+$' ORDER BY slug LIMIT 20`
    );
    sv.forEach(r => console.log(`    ${r.slug}`));
  } else {
    console.log('  ✓  No numeric-suffix slugs remain.');
  }

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e.message); pool.end(); process.exit(1); });
