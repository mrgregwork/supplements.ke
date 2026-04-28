require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const cats = await pool.query(`SELECT id, slug, name, sort_order, is_active FROM categories ORDER BY sort_order, name`);
  console.log(`\n=== CATEGORIES (${cats.rows.length}) ===`);
  for (const c of cats.rows) {
    console.log(`  [${String(c.sort_order).padStart(3)}] ${c.slug.padEnd(35)} "${c.name}" (${c.id}) active:${c.is_active}`);
    const subs = await pool.query(`SELECT slug, name, sort_order FROM subcategories WHERE category_id = $1 ORDER BY sort_order, name`, [c.id]);
    subs.rows.forEach(s => console.log(`         └─ ${s.slug.padEnd(35)} "${s.name}"`));
  }
  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
