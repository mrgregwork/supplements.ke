require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // 1. Overall counts
  const { rows: [totals] } = await pool.query(`
    SELECT
      COUNT(*)                                         AS total_products,
      COUNT(DISTINCT LOWER(TRIM(name)))               AS unique_names,
      COUNT(*) - COUNT(DISTINCT LOWER(TRIM(name)))    AS excess_rows
    FROM products
  `);
  console.log('=== Overall ===');
  console.log(`  Total rows      : ${totals.total_products}`);
  console.log(`  Unique names    : ${totals.unique_names}`);
  console.log(`  Excess (dups)   : ${totals.excess_rows}`);

  // 2. Distribution: how many copies per name?
  const { rows: dist } = await pool.query(`
    SELECT copies, COUNT(*) AS groups
    FROM (
      SELECT COUNT(*) AS copies FROM products GROUP BY LOWER(TRIM(name))
    ) sub
    GROUP BY copies ORDER BY copies
  `);
  console.log('\n=== Copy distribution ===');
  dist.forEach(r => console.log(`  ${r.copies}x copies : ${r.groups} product names`));

  // 3. Slug suffix pattern — show a sample of duplicates
  const { rows: sample } = await pool.query(`
    SELECT name, slug, category_id, subcategory_id, created_at
    FROM products
    WHERE LOWER(TRIM(name)) IN (
      SELECT LOWER(TRIM(name)) FROM products
      GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1
      LIMIT 5
    )
    ORDER BY LOWER(TRIM(name)), created_at
    LIMIT 30
  `);
  console.log('\n=== Sample duplicate groups (first 5 names) ===');
  let lastName = '';
  sample.forEach(r => {
    if (r.name !== lastName) { console.log(`\n  "${r.name}"`); lastName = r.name; }
    console.log(`    slug: ${r.slug}   created: ${r.created_at.toISOString().slice(0,19)}`);
  });

  // 4. Check for products that differ only by slug suffix (-2, -3, -4, …)
  const { rows: suffixed } = await pool.query(`
    SELECT slug FROM products WHERE slug ~ '-[0-9]+$' LIMIT 20
  `);
  console.log(`\n=== Slugs with numeric suffix (-N): ${suffixed.length} shown ===`);
  suffixed.slice(0, 15).forEach(r => console.log(`  ${r.slug}`));

  // 5. Category-level breakdown of duplicates
  const { rows: catDups } = await pool.query(`
    SELECT c.name AS category,
           COUNT(p.id) AS total,
           COUNT(DISTINCT LOWER(TRIM(p.name))) AS unique_names
    FROM products p
    JOIN categories c ON p.category_id = c.id
    GROUP BY c.name ORDER BY total DESC
  `);
  console.log('\n=== Duplicates by category ===');
  catDups.forEach(r =>
    console.log(`  ${r.category.padEnd(30)} total: ${String(r.total).padStart(4)}  unique: ${String(r.unique_names).padStart(4)}  dups: ${r.total - r.unique_names}`)
  );

  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
