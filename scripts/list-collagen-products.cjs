require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query(`
    SELECT p.id, p.name, s.name AS subcat, s.slug AS subcat_slug
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN subcategories s ON p.subcategory_id = s.id
    WHERE LOWER(c.name) = 'collagen'
    ORDER BY s.name NULLS LAST, p.name
  `);

  rows.forEach(r => console.log(`${(r.subcat_slug || 'NONE').padEnd(30)} | ${r.id} | ${r.name}`));
  console.log('\nTotal collagen products:', rows.length);

  // Summary by subcategory
  const counts = {};
  rows.forEach(r => { const k = r.subcat || '(unassigned)'; counts[k] = (counts[k] || 0) + 1; });
  console.log('\nBy subcategory:');
  Object.entries(counts).sort().forEach(([k, v]) => console.log(`  ${v.toString().padStart(3)}  ${k}`));

  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
