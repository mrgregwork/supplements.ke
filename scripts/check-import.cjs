require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const products = await pool.query('SELECT COUNT(*) as total FROM products');
  const active = await pool.query("SELECT COUNT(*) as total FROM products WHERE status = 'active'");
  const cats = await pool.query('SELECT COUNT(*) as total FROM categories');
  const subcats = await pool.query('SELECT COUNT(*) as total FROM subcategories');

  // Products by category
  const byCat = await pool.query(`
    SELECT c.name, COUNT(p.id) as count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.name
    ORDER BY count DESC
  `);

  console.log('=== Import Status ===');
  console.log('Total products:', products.rows[0].total);
  console.log('Active products:', active.rows[0].total);
  console.log('Categories:', cats.rows[0].total);
  console.log('Subcategories:', subcats.rows[0].total);
  console.log('\nProducts by category:');
  byCat.rows.forEach(r => console.log(' ', r.name, ':', r.count));

  await pool.end();
}
check().catch(e => { console.error(e.message); pool.end(); });
