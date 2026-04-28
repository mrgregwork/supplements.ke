require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const rows = await pool.query(`
    SELECT slug, name, brand, description, category_slug, subcategory_slug,
           attributes, price, currency
    FROM products
    WHERE description IS NULL OR description = '' OR long_description IS NULL OR long_description = ''
    ORDER BY brand, name
  `);
  const fs = require('fs');
  fs.writeFileSync('scripts/data/missing-descriptions.json', JSON.stringify(rows.rows, null, 2));
  console.log(`Wrote ${rows.rows.length} products to scripts/data/missing-descriptions.json`);

  // Print brand summary
  const brands = {};
  rows.rows.forEach(r => { brands[r.brand] = (brands[r.brand] || 0) + 1; });
  Object.entries(brands).sort((a,b) => b[1]-a[1]).forEach(([b,n]) => console.log(`  ${n.toString().padStart(4)}  ${b}`));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => pool.end());
