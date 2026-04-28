require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const r = await pool.query(`
    SELECT c.slug AS cat, s.slug AS sub, s.name, s.is_active
    FROM subcategories s JOIN categories c ON c.id = s.category_id
    ORDER BY c.slug, s.slug
  `);
  let lastCat = '';
  for (const row of r.rows) {
    if (row.cat !== lastCat) { console.log(`\n[${row.cat}]`); lastCat = row.cat; }
    console.log(`  ${row.sub}${row.is_active ? '' : ' (inactive)'}`);
  }
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
