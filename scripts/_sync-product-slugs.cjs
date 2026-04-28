// Syncs products.category_slug and products.subcategory_slug
// to match the actual current slug from the categories/subcategories tables.
// Run this after any category rename or product reassignment.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DRY = process.argv.includes('--dry');

async function main() {
  // Find all products where stored slugs don't match the actual category/subcategory slugs
  const stale = await pool.query(`
    SELECT
      p.id,
      p.name,
      p.slug AS product_slug,
      p.category_slug AS stored_cat_slug,
      c.slug AS real_cat_slug,
      p.subcategory_slug AS stored_sub_slug,
      s.slug AS real_sub_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN subcategories s ON s.id = p.subcategory_id
    WHERE
      (p.category_slug IS DISTINCT FROM c.slug)
      OR (p.subcategory_slug IS DISTINCT FROM s.slug)
    ORDER BY p.name
  `);

  console.log(`Found ${stale.rows.length} products with stale slugs:\n`);
  for (const r of stale.rows) {
    const catChanged = r.stored_cat_slug !== r.real_cat_slug;
    const subChanged = r.stored_sub_slug !== r.real_sub_slug;
    if (catChanged) console.log(`  ${r.name}  category: "${r.stored_cat_slug}" -> "${r.real_cat_slug}"`);
    if (subChanged) console.log(`  ${r.name}  subcategory: "${r.stored_sub_slug}" -> "${r.real_sub_slug}"`);
  }

  if (DRY) {
    console.log('\nDry run — no changes made.');
    return;
  }

  // Bulk update all products to sync their slugs from the joined tables
  const result = await pool.query(`
    UPDATE products
    SET
      category_slug = c.slug,
      subcategory_slug = s.slug,
      updated_at = NOW()
    FROM categories c,
         (SELECT id, slug FROM subcategories) s
    WHERE c.id = products.category_id
      AND s.id = products.subcategory_id
      AND (
        products.category_slug IS DISTINCT FROM c.slug
        OR products.subcategory_slug IS DISTINCT FROM s.slug
      )
  `);

  console.log(`\nUpdated ${result.rowCount} products.`);
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
