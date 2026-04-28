require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const checks = [
    ['beauty-supplements', null],
    ['specialty-supplements', 'sleep'],
    ['specialty-supplements', 'brain-cognitive'],
    ['specialty-supplements', 'bones-joints'],
  ];

  for (const [cat, sub] of checks) {
    const cr = await pool.query('SELECT id, slug FROM categories WHERE slug=$1', [cat]);
    if (!cr.rows.length) { console.log(`MISSING category: ${cat}`); continue; }
    const catId = cr.rows[0].id;

    if (!sub) {
      const pr = await pool.query('SELECT COUNT(*) FROM products WHERE category_id=$1', [catId]);
      console.log(`${cat}: category exists, ${pr.rows[0].count} products`);
    } else {
      const sr = await pool.query('SELECT id, slug FROM subcategories WHERE slug=$1 AND category_id=$2', [sub, catId]);
      if (!sr.rows.length) { console.log(`MISSING subcategory: ${cat}/${sub}`); continue; }
      const subId = sr.rows[0].id;
      const pr = await pool.query('SELECT COUNT(*) FROM products WHERE subcategory_id=$1', [subId]);
      console.log(`${cat}/${sub}: exists, ${pr.rows[0].count} products`);
    }
  }

  // Also check collagen/collagen-powder
  const cr = await pool.query("SELECT id FROM categories WHERE slug='collagen'");
  if (cr.rows.length) {
    const sr = await pool.query("SELECT id FROM subcategories WHERE slug='collagen-powder' AND category_id=$1", [cr.rows[0].id]);
    if (sr.rows.length) {
      const pr = await pool.query('SELECT COUNT(*) FROM products WHERE subcategory_id=$1', [sr.rows[0].id]);
      console.log(`collagen/collagen-powder: exists, ${pr.rows[0].count} products`);
    } else {
      console.log('MISSING: collagen/collagen-powder');
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => pool.end());
