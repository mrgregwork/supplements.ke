require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  // Find what category owns omega-3
  const cat = await pool.query(`SELECT id, slug, name FROM categories WHERE id='2005ec41-94c4-4fc2-b84b-cab2c32ec434'`);
  console.log('Category that owns omega-3:', cat.rows);

  // Check the mega-epa-dha product category/subcategory ids
  const prod = await pool.query(`SELECT id, name, slug, category_id, subcategory_id FROM products WHERE slug='mega-epa-dha-omega-3'`);
  console.log('Product:', prod.rows);

  // Check all categories
  const allCats = await pool.query(`SELECT id, slug, name, is_active FROM categories ORDER BY name`);
  console.log('All categories:', allCats.rows.map(r => `${r.slug} (${r.id}) active:${r.is_active}`));
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
