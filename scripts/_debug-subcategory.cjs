require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  // Check category
  const cat = await pool.query(`SELECT id, slug, name, is_active FROM categories WHERE slug='food-supplements'`);
  console.log('Category:', cat.rows);

  if (!cat.rows.length) {
    // Try to find it
    const allCats = await pool.query(`SELECT id, slug, name, is_active FROM categories ORDER BY name`);
    console.log('All categories:', allCats.rows);
    await pool.end(); return;
  }

  const catId = cat.rows[0].id;

  // Check subcategory
  const sub = await pool.query(`SELECT id, slug, name, is_active, category_id FROM subcategories WHERE slug='omega-3' AND category_id=$1`, [catId]);
  console.log('Subcategory (omega-3 under food-supplements):', sub.rows);

  // Also check all omega-3 subs
  const allOmega = await pool.query(`SELECT id, slug, name, is_active, category_id FROM subcategories WHERE slug ILIKE '%omega%'`);
  console.log('All omega subcategories:', allOmega.rows);

  // Check what subcategories food-supplements has
  const allSubs = await pool.query(`SELECT id, slug, name, is_active FROM subcategories WHERE category_id=$1 ORDER BY name`, [catId]);
  console.log(`All subcategories under food-supplements (${allSubs.rows.length}):`, allSubs.rows.map(r => `${r.slug} (active:${r.is_active})`));
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
