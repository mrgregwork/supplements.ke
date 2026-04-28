require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  // Products on food-supplements page with null subcategory slug
  const r = await pool.query(`
    SELECT p.name, p.slug, p.category_slug, p.subcategory_slug, p.category_id, p.subcategory_id,
           c.slug AS cat_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE (p.subcategory_id IS NULL OR p.subcategory_slug IS NULL OR p.subcategory_slug = 'null')
    ORDER BY p.name
    LIMIT 30
  `);
  console.log(`Products with null subcategory (${r.rows.length}):`);
  r.rows.forEach(p => console.log(`  ${p.slug} | cat: ${p.cat_slug} | sub_slug: ${p.subcategory_slug}`));
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
