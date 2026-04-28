require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const slugs = [
    'high-absorption-magnesium-glycinate-lysinate-doctors-best',
    'black-cohosh-root-for-womens-health',
    'reduced-glutathione-60-capsules-natures-craft',
  ];
  for (const slug of slugs) {
    const r = await pool.query(`SELECT slug, name, brand FROM products WHERE slug=$1`, [slug]);
    if (r.rows.length) {
      const p = r.rows[0];
      console.log(`${slug}:`);
      console.log(`  brand: "${p.brand}" (codes: ${p.brand ? [...p.brand].map(c=>c.codePointAt(0)).join(',') : 'null'})`);
      console.log(`  brand url: /brand/${(p.brand||'').toLowerCase().replace(/\s+/g,'-')}/`);
    } else {
      console.log(`${slug}: NOT FOUND`);
    }
  }

  // Find all products with short brand names (likely wrong)
  console.log('\nProducts with brand <= 8 chars:');
  const r2 = await pool.query(`SELECT DISTINCT brand FROM products WHERE length(brand) <= 8 AND brand NOT IN ('Now', 'Sports') ORDER BY brand`);
  r2.rows.forEach(r => console.log(`  "${r.brand}"`));
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
