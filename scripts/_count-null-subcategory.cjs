require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const total = await pool.query(`SELECT COUNT(*) FROM products WHERE subcategory_id IS NULL`);
  console.log('Total products with null subcategory_id:', total.rows[0].count);

  const byCat = await pool.query(`
    SELECT c.slug AS category, COUNT(p.id) AS count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.subcategory_id IS NULL
    GROUP BY c.slug
    ORDER BY count DESC
  `);
  console.log('\nBy category:');
  byCat.rows.forEach(r => console.log(`  ${r.category}: ${r.count}`));
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
