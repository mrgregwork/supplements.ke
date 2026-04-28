require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Total missing descriptions
  const total = await pool.query(`
    SELECT COUNT(*) FROM products
    WHERE description IS NULL OR description = '' OR long_description IS NULL OR long_description = ''
  `);
  console.log(`\nTotal products missing description or long_description: ${total.rows[0].count}`);

  // By brand
  const byBrand = await pool.query(`
    SELECT brand, COUNT(*) as missing
    FROM products
    WHERE description IS NULL OR description = '' OR long_description IS NULL OR long_description = ''
    GROUP BY brand
    ORDER BY missing DESC
    LIMIT 30
  `);
  console.log('\nTop brands with missing descriptions:');
  byBrand.rows.forEach(r => console.log(`  ${r.missing.toString().padStart(4)}  ${r.brand}`));

  // Sample products needing descriptions (Jarrow first)
  const jarrow = await pool.query(`
    SELECT slug, name, brand, description, category_slug, subcategory_slug
    FROM products
    WHERE (brand ILIKE '%jarrow%')
      AND (description IS NULL OR description = '' OR long_description IS NULL OR long_description = '')
    ORDER BY name
    LIMIT 5
  `);
  console.log(`\nJarrow Formulas needing descriptions (sample of 5):`);
  jarrow.rows.forEach(r => console.log(`  ${r.slug}\n    name: ${r.name}\n    cat: ${r.category_slug}/${r.subcategory_slug}`));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => pool.end());
