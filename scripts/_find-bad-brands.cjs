require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  // Products whose brand generates the broken slugs found in audit
  const queries = [
    { slug: 'doctor', search: 'doctor' },
    { slug: 'nature', search: 'nature' },
  ];
  for (const q of queries) {
    const r = await pool.query(
      `SELECT slug, name, brand FROM products WHERE brand ILIKE $1 ORDER BY name LIMIT 5`,
      [q.search]
    );
    console.log(`\nbrand ILIKE '${q.search}':`);
    r.rows.forEach(p => console.log(`  "${p.brand}" | ${p.slug}`));
  }

  // Also check for brand names that have typographic apostrophes
  const r2 = await pool.query(`
    SELECT DISTINCT brand FROM products WHERE brand ILIKE 'nature%craft%' OR brand ILIKE '%nature%craft%'
  `);
  console.log('\nNature*Craft brands:', r2.rows.map(r => r.brand));

  // Find all unique brands with special chars
  const r3 = await pool.query(`
    SELECT DISTINCT brand FROM products
    WHERE brand ~ '[^a-zA-Z0-9 &/.,+()-]'
    ORDER BY brand
  `);
  console.log('\nBrands with special characters:');
  r3.rows.forEach(r => console.log(`  "${r.brand}" (codes: ${[...r.brand].map(c => c.codePointAt(0)).join(',')})`));
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
