// Finds all products where category_id != subcategory's parent category_id,
// and fixes them by updating product.category_id to match the subcategory's category.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DRY = process.argv.includes('--dry');

async function main() {
  // Find all mismatched products
  const mismatches = await pool.query(`
    SELECT p.id, p.name, p.slug,
           p.category_id AS prod_cat_id,
           c.slug AS prod_cat_slug,
           s.id AS sub_id,
           s.slug AS sub_slug,
           s.category_id AS sub_cat_id,
           sc.slug AS sub_cat_slug
    FROM products p
    JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = p.category_id
    JOIN categories sc ON sc.id = s.category_id
    WHERE p.category_id != s.category_id
    ORDER BY p.name
  `);

  console.log(`Found ${mismatches.rows.length} mismatched products:\n`);
  for (const r of mismatches.rows) {
    console.log(`  ${r.name} (${r.slug})`);
    console.log(`    product.category = ${r.prod_cat_slug}`);
    console.log(`    subcategory.parent = ${r.sub_cat_slug}`);
    console.log(`    -> will update category to: ${r.sub_cat_slug}\n`);
  }

  if (DRY) {
    console.log('Dry run — no changes made.');
    return;
  }

  let fixed = 0;
  for (const r of mismatches.rows) {
    await pool.query(
      `UPDATE products SET category_id=$1, updated_at=NOW() WHERE id=$2`,
      [r.sub_cat_id, r.id]
    );
    fixed++;
  }

  console.log(`Fixed ${fixed} products.`);
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
