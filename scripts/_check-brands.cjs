require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  // Find distinct brands that would generate problematic slugs
  const r = await pool.query(`
    SELECT DISTINCT brand,
      lower(brand) AS brand_lower,
      regexp_replace(lower(brand), '[^a-z0-9\\s]', '', 'g') AS stripped,
      regexp_replace(regexp_replace(lower(brand), '[^a-z0-9\\s]', '', 'g'), '\\s+', '-', 'g') AS slug
    FROM products
    WHERE brand IS NOT NULL
    ORDER BY brand
  `);
  for (const row of r.rows) {
    // Flag brands where the slug would fail lookup
    const searchName = row.slug.replace(/-/g, ' ');
    const result = await pool.query(`SELECT COUNT(*) FROM products WHERE brand ILIKE $1`, [searchName]);
    const found = parseInt(result.rows[0].count);
    if (!found) {
      console.log(`BROKEN: "${row.brand}" -> slug: "${row.slug}" -> search: "${searchName}" -> found: ${found}`);
    }
  }
  console.log('\nAll brands that generate working URLs verified.');
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
