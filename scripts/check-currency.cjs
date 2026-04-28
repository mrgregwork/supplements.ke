require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query(
    "SELECT key, value FROM site_settings WHERE key ILIKE '%currency%' OR key ILIKE '%price%' ORDER BY key"
  );
  console.log('Currency/price settings in DB:');
  if (rows.length === 0) {
    console.log('  (none found)');
  } else {
    rows.forEach(r => console.log(`  ${r.key} = ${r.value}`));
  }
  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
